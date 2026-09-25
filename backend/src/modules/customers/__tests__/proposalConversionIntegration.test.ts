import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../identity/sessionRuntime";

const ids = {
  submitter: randomUUID(),
  reviewer: randomUUID(),
  adminUser: randomUUID(),
  salesRep: randomUUID(),
  product: randomUUID(),
  variant: randomUUID(),
};
const phones: string[] = [];
const app = createApp();

afterAll(async () => {
  const sessionSubjects = [ids.submitter, ids.reviewer, ...phones];
  const sessionRows = await prisma.deviceSession.findMany({
    where: { subjectId: { in: sessionSubjects } },
    select: { id: true },
  });
  await prisma.deviceSession.deleteMany({ where: { id: { in: sessionRows.map((row) => row.id) } } });

  const retailers = await prisma.retailer.findMany({ where: { phone: { in: phones } }, select: { id: true } });
  const retailerIds = retailers.map((retailer) => retailer.id);
  const orders = await prisma.order.findMany({ where: { retailerId: { in: retailerIds } }, select: { id: true } });
  const orderIds = orders.map((order) => order.id);
  const proposalRowIds = await proposalIds();
  const intents = await prisma.retailerProposalOrderIntent.findMany({
    where: { proposalId: { in: proposalRowIds } },
    select: { id: true },
  });
  const intentIds = intents.map((intent) => intent.id);

  await prisma.auditEvent.deleteMany({ where: { subjectId: { in: [...retailerIds, ...orderIds, ...intentIds, ...proposalRowIds] } } });
  await prisma.retailerProposalOrderIntentItem.deleteMany({ where: { intentId: { in: intentIds } } });
  await prisma.retailerProposalOrderIntent.deleteMany({ where: { id: { in: intentIds } } });
  await prisma.sapOutbox.deleteMany({ where: { referenceId: { in: orderIds } } });
  await prisma.dispatchAuthorization.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.approvalDecision.deleteMany({ where: { approvalRequest: { orderId: { in: orderIds } } } });
  await prisma.approvalEscalation.deleteMany({ where: { approvalRequest: { orderId: { in: orderIds } } } });
  await prisma.approvalDispute.deleteMany({ where: { approvalRequest: { orderId: { in: orderIds } } } });
  await prisma.approvalRequest.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.creditDecisionComparison.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.creditAssessment.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.commercialStatusEvent.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.creditProfile.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.retailerLocation.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.retailerProposal.deleteMany({ where: { phone: { in: phones } } });
  await prisma.retailer.deleteMany({ where: { id: { in: retailerIds } } });
  await prisma.priceList.deleteMany({ where: { variantId: ids.variant } });
  await prisma.inventorySnapshot.deleteMany({ where: { productId: ids.product } });
  await prisma.variant.deleteMany({ where: { id: ids.variant } });
  await prisma.product.deleteMany({ where: { id: ids.product } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.submitter, ids.reviewer] } } });
  await prisma.salesRep.deleteMany({ where: { id: ids.salesRep } });
  await prisma.adminUser.deleteMany({ where: { id: ids.adminUser } });

  expect(await prisma.retailerProposal.count({ where: { phone: { in: phones } } })).toBe(0);
  expect(await prisma.retailer.count({ where: { phone: { in: phones } } })).toBe(0);
  expect(await prisma.product.count({ where: { id: ids.product } })).toBe(0);
  expect(await prisma.variant.count({ where: { id: ids.variant } })).toBe(0);
  expect(await prisma.staffUser.count({ where: { id: { in: [ids.submitter, ids.reviewer] } } })).toBe(0);
  expect(await prisma.adminUser.count({ where: { id: ids.adminUser } })).toBe(0);
});

async function proposalIds() {
  const rows = await prisma.retailerProposal.findMany({ where: { phone: { in: phones } }, select: { id: true } });
  return rows.map((row) => row.id);
}

describe("approved proposal order conversion API", () => {
  it("keeps pending demand unpriced, then converts once through the canonical order engine after approval", async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
    await prisma.salesRep.create({ data: { id: ids.salesRep, name: "Proposal conversion rep", phone: `rep-${ids.salesRep}` } });
    await prisma.adminUser.create({
      data: { id: ids.adminUser, email: `${ids.adminUser}@test.invalid`, name: "Proposal conversion reviewer", passwordHash: "test-only" },
    });
    await prisma.staffUser.createMany({
      data: [
        { id: ids.submitter, name: "Proposal conversion rep", phone: ids.submitter, email: `${ids.submitter}@test.invalid`, salesRepId: ids.salesRep },
        { id: ids.reviewer, name: "Proposal conversion reviewer", phone: ids.reviewer, email: `${ids.reviewer}@test.invalid`, adminUserId: ids.adminUser },
      ],
    });
    await prisma.staffRole.createMany({ data: [
      { staffId: ids.submitter, roleId: role.id },
      { staffId: ids.reviewer, roleId: role.id },
    ] });
    const [submitterSession, reviewerSession] = await Promise.all([
      lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.submitter, deviceName: "proposal-conversion-test" }),
      lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.reviewer, deviceName: "proposal-conversion-test" }),
    ]);

    const sapMaterialId = `TEST-${ids.variant}`;
    await prisma.product.create({ data: { id: ids.product, name: "Proposal conversion item", category: "Test", sapMaterialId } });
    await prisma.variant.create({
      data: { id: ids.variant, productId: ids.product, unitSize: "1 case", unit: "case", unitsPerCase: 1, unitWeightKg: 1 },
    });
    const tier = await prisma.tier.findFirstOrThrow({ select: { id: true } });
    await prisma.priceList.create({ data: { tierId: tier.id, productId: ids.product, variantId: ids.variant, price: 10_000 } });
    await prisma.inventorySnapshot.create({
      data: { productId: ids.product, variantId: ids.variant, sapMaterialId, warehouseCode: "WH-001", onHand: 1_000, available: 1_000, syncedAt: new Date(), status: "available" },
    });

    const phone = randomUUID();
    phones.push(phone);
    const proposal = await prisma.retailerProposal.create({
      data: {
        businessName: `Proposal conversion ${phone.slice(0, 8)}`,
        phone,
        shopAddress: "Disposable local test fixture",
        proposedTierId: tier.id,
        submittedByStaffId: ids.submitter,
      },
    });

    const punched = await request(app)
      .post(`/rep/retailer-proposals/${proposal.id}/order-intents`)
      .set("Authorization", `Bearer ${submitterSession.accessToken}`)
      .set("Idempotency-Key", `proposal-conversion-${proposal.id}`)
      .send({ items: [{ variantId: ids.variant, qty: 1 }] });
    expect(punched.status).toBe(201);
    const intentId = punched.body.intent.id as string;
    expect(punched.body.intent.items[0]).not.toHaveProperty("unitPrice");

    const earlyConversion = await request(app)
      .post(`/rep/retailer-proposal-order-intents/${intentId}/convert`)
      .set("Authorization", `Bearer ${submitterSession.accessToken}`)
      .send({});
    expect(earlyConversion.status).toBe(409);
    expect(earlyConversion.body.error).toBe("retailer_approval_required");
    expect(await prisma.retailer.count({ where: { phone } })).toBe(0);

    const approved = await request(app)
      .post(`/admin/retailer-proposals/${proposal.id}/approve`)
      .set("Authorization", `Bearer ${reviewerSession.accessToken}`)
      .send({ tierId: tier.id });
    expect(approved.status).toBe(200);
    const retailerId = approved.body.retailer.id as string;
    expect(approved.body.retailer.status).toBe("pending_kyc");

    // Supply the ordinary, approved customer-master prerequisites so the test exercises
    // proposal conversion rather than failing at unrelated KYC/credit admission gates.
    await prisma.retailer.update({ where: { id: retailerId }, data: { status: "active", creditLimit: 1_000_000 } });
    await prisma.creditProfile.create({ data: { retailerId, rating: "A", billingPattern: "unknown", kycVerifiedAt: new Date() } });

    const converted = await request(app)
      .post(`/rep/retailer-proposal-order-intents/${intentId}/convert`)
      .set("Authorization", `Bearer ${submitterSession.accessToken}`)
      .send({});
    expect(converted.status).toBe(201);
    const orderId = converted.body.order.id as string;
    expect(converted.body).toMatchObject({ alreadyConverted: false, order: { id: orderId, retailerId, status: "placed" } });
    expect(converted.body.dispatchAuthorization).toBeTruthy();

    const intentReadback = await request(app)
      .get(`/rep/retailer-proposal-order-intents/${intentId}`)
      .set("Authorization", `Bearer ${submitterSession.accessToken}`)
      .expect(200);
    expect(intentReadback.body.intent).toMatchObject({ demandState: "converted", convertedOrderId: orderId });

    const retailerSession = await lazyIdentitySessionService.createSession({ realm: "retailer", subjectId: retailerId, deviceName: "proposal-conversion-test" });
    const retailerOrder = await request(app)
      .get(`/orders/${orderId}`)
      .set("Authorization", `Bearer ${retailerSession.accessToken}`)
      .expect(200);
    expect(retailerOrder.body.order).toMatchObject({ id: orderId, salesOrderState: "created" });
    expect(retailerOrder.body.order).not.toHaveProperty("commercialStatusEvents");

    const retry = await request(app)
      .post(`/rep/retailer-proposal-order-intents/${intentId}/convert`)
      .set("Authorization", `Bearer ${submitterSession.accessToken}`)
      .send({});
    expect(retry.status).toBe(201);
    expect(retry.body).toMatchObject({ alreadyConverted: true, order: { id: orderId } });
    expect(await prisma.order.count({ where: { retailerId } })).toBe(1);
    expect(await prisma.sapOutbox.count({ where: { kind: "sales_order", referenceId: orderId } })).toBe(1);
  });
});
