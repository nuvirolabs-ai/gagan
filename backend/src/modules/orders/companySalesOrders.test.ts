import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { createOrderForRetailer } from "../../lib/orders";
import { prisma } from "../../lib/prisma";
import { MockSapConnector } from "../../lib/sap/mockConnector";
import { drainOutbox } from "../../lib/sap/outbox";
import { quoteFor, setFreight } from "../commercial/service";
import { createInvoiceForDelivery } from "../invoicing/invoiceService";
import { RetailerProposalService } from "../customers/retailerProposalService";
import { identitySessionService } from "../identity/sessionRuntime";

const server = createServer(createApp());
const JT = "jain_traders";
const PI = "padam_international";
const retailerId = randomUUID();
const tierId = randomUUID();
const productIds: string[] = [];
const variants = new Map<string, string>();
const labels = new Map<string, string>();
const sessionIds: string[] = [];
const outside = "Bhopal";
const address = "Company order test ship-to";
let adminToken: string;
let repToken: string;
let retailerToken: string;
let enabled = false;

function items(input: string) {
  return input.split(" ").map(pair => {
    const [product, quantity] = pair.split(":");
    return { variantId: variants.get(product)!, qty: Number(quantity) };
  });
}

async function quote(input: string) {
  const result = await quoteFor(retailerId, items(input));
  if (!result) throw new Error("expected routed quote");
  return { quoteId: result.id, revision: result.revision };
}

async function setDestination(deliveryCity: string | null, shopAddress = address) {
  await prisma.retailer.update({ where: { id: retailerId }, data: { deliveryCity, shopAddress } });
}

async function submit(input: string, commercial: Awaited<ReturnType<typeof quote>>, key = randomUUID()) {
  const result = await createOrderForRetailer(retailerId, items(input), "retailer", undefined, undefined, key, commercial);
  if (!result.ok) throw new Error(JSON.stringify(result.body));
  return result.order.id as string;
}

async function readCompanyOrders(orderId: string) {
  return prisma.companySalesOrder.findMany({
    where: { orderId },
    include: { items: true },
    orderBy: { company: "asc" },
  });
}

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.includes("test")) {
    throw new Error("Disposable local test database required");
  }
  enabled = true;
  const [admin, rep] = await Promise.all([
    prisma.staffUser.findFirstOrThrow({ where: { adminUserId: { not: null } } }),
    prisma.staffUser.findFirstOrThrow({ where: { salesRepId: { not: null } } }),
  ]);
  await prisma.tier.create({ data: { id: tierId, name: tierId } });
  await prisma.retailer.create({
    data: {
      id: retailerId, name: "Company order test", phone: retailerId, tierId, creditLimit: 9_000_000,
      deliveryCity: outside, shopAddress: address, salesRepId: rep.salesRepId, sapCustomerId: `MOCK-${retailerId}`,
      status: "active",
    },
  });
  await prisma.creditProfile.create({ data: { retailerId, rating: "N", kycVerifiedAt: new Date() } });
  const sessions = identitySessionService();
  const [adminSession, repSession, retailerSession] = await Promise.all([
    sessions.createSession({ realm: "admin", subjectId: admin.id }),
    sessions.createSession({ realm: "staff", subjectId: rep.id }),
    sessions.createSession({ realm: "retailer", subjectId: retailerId }),
  ]);
  [adminToken, repToken, retailerToken] = [adminSession.accessToken, repSession.accessToken, retailerSession.accessToken];
  sessionIds.push(adminSession.session.id, repSession.session.id, retailerSession.session.id);
  for (const [key, routingClass, weight] of [
    ["LT", "LAXMI_TOOR", 30], ["LTB", "LAXMI_TOOR", 50],
    ["R", "OTHER", 30], ["P", "OTHER", 30], ["S", "OTHER", 30], ["KA", "OTHER", 30],
    ["OD", "OTHER", 30], ["N", "OTHER", 30], ["L", "OTHER", 30],
    ["M4", "INSTANT_MIX", 4], ["M5", "INSTANT_MIX", 5], ["M10", "INSTANT_MIX", 10],
    ["M25", "INSTANT_MIX", 25], ["LEG", null, 30], ["PROMO_RICE", "OTHER", 30],
  ] as const) {
    const product = await prisma.product.create({
      data: { name: `Company order test ${key} ${retailerId}`, category: key === "PROMO_RICE" ? "Rice" : "Audit", sapMaterialId: `${retailerId}-${key}` },
    });
    productIds.push(product.id);
    const variant = await prisma.variant.create({
      data: {
        productId: product.id, unitSize: `${weight}kg`, unit: "kg", unitsPerCase: 1, unitWeightKg: weight,
        routingClass, routingBagEquivalent: routingClass === "OTHER" ? "1.000" : null,
        gstPercent: routingClass ? 5 : null,
      },
    });
    await prisma.priceList.create({ data: { tierId, productId: product.id, variantId: variant.id, rateBasis: "case", price: 3000 } });
    variants.set(key, variant.id);
    labels.set(variant.id, key);
  }
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
});

afterAll(async () => {
  if (server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  if (!enabled) return;
  const [orders, documents, ledger] = await Promise.all([
    prisma.order.findMany({ where: { retailerId }, select: { id: true } }),
    prisma.companySalesOrder.findMany({ where: { order: { retailerId } }, select: { id: true } }),
    prisma.ledgerEntry.findMany({ where: { retailerId }, select: { id: true } }),
  ]);
  const ids = [...orders, ...documents, ...ledger].map(row => row.id);
  const proposals = await prisma.retailerProposal.findMany({ where: { retailerId }, select: { id: true } });
  const proposalIds = proposals.map(proposal => proposal.id);
  const intents = await prisma.retailerProposalOrderIntent.findMany({
    where: { proposalId: { in: proposalIds } }, select: { id: true },
  });
  ids.push(...intents.map(intent => intent.id));
  await prisma.auditEvent.deleteMany({ where: { subjectId: { in: ids } } });
  await prisma.retailerProposalOrderIntent.deleteMany({ where: { proposalId: { in: proposalIds } } });
  await prisma.retailerProposal.deleteMany({ where: { id: { in: proposalIds } } });
  await prisma.sapOutbox.deleteMany({ where: { referenceId: { in: ids } } });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { retailerId } } });
  await prisma.invoice.deleteMany({ where: { retailerId } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId } });
  await prisma.delivery.deleteMany({ where: { order: { retailerId } } });
  await prisma.dispatchAuthorization.deleteMany({ where: { order: { retailerId } } });
  await prisma.approvalRequest.deleteMany({ where: { retailerId } });
  await prisma.creditDecisionComparison.deleteMany({ where: { retailerId } });
  await prisma.creditAssessment.deleteMany({ where: { retailerId } });
  await prisma.orderItem.deleteMany({ where: { order: { retailerId } } });
  await prisma.order.deleteMany({ where: { retailerId } });
  await prisma.commercialQuote.deleteMany({ where: { retailerId } });
  await prisma.creditProfile.deleteMany({ where: { retailerId } });
  await prisma.deviceSession.deleteMany({ where: { id: { in: sessionIds } } });
  await prisma.retailer.deleteMany({ where: { id: retailerId } });
  await prisma.priceList.deleteMany({ where: { tierId } });
  await prisma.variant.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.tier.deleteMany({ where: { id: tierId } });
});

describe("confirmed routing scenarios persisted as company sales orders", () => {
  it.each([
    ["T01", "Indore", "R:100", "", 1], ["T02", "Indore", "LT:20 R:5", "", 1],
    ["T03", "Indore", "KA:2 OD:3 P:20", "", 1], ["T04", "Indore", "LT:1 M10:1 R:10", "", 1],
    ["T05", outside, "LT:1", "", 1], ["T06", outside, "LT:100", "", 1],
    ["T07", outside, "R:1", "", 1], ["T08", outside, "R:4", "", 1],
    ["T09", outside, "R:5", "R", 1], ["T10", outside, "R:6", "R", 1],
    ["T11", outside, "LT:100 R:4", "", 1], ["T12", outside, "LT:1 R:5", "R", 2],
    ["T13", outside, "LT:100 R:10", "R", 2], ["T14", outside, "KA:2 R:2", "", 1],
    ["T15", outside, "KA:2 R:3", "KA R", 1], ["T16", outside, "OD:1 P:4", "OD P", 1],
    ["T17", outside, "KA:2 OD:2", "", 1], ["T18", outside, "KA:2 OD:2 S:1", "KA OD S", 1],
    ["T19", outside, "LT:20 KA:2 OD:2", "", 1], ["T20", outside, "LT:20 KA:2 OD:2 S:1", "KA OD S", 2],
    ["T21", outside, "R:1 P:1 S:1 KA:1 OD:1", "R P S KA OD", 1], ["T22", outside, "R:2 R:3", "R", 1],
    ["T23", outside, "KA:5", "KA", 1], ["T24", outside, "OD:5", "OD", 1],
    ["T25", outside, "N:5", "N", 1], ["T26", outside, "L:5", "L", 1],
    ["T27", outside, "LT:5 R:1", "", 1], ["T28", outside, "LT:20 M4:1", "", 1],
    ["T29", "Indore City", "M5:1", "", 1], ["T30", outside, "LT:2 LTB:10 R:5", "R", 2],
    ["T31", outside, "R:4 LT:1", "", 1], ["T32", outside, "R:5 LT:1", "R", 2],
    ["T33", "Indore", "LT:1 R:50", "", 1], ["T34", outside, "LT:1 R:50", "R", 2],
    ["BD01", outside, "LT:1 M25:1", "M25", 2],
  ] as const)("%s creates exactly the expected company documents", async (id, city, input, padam, count) => {
    const shop = id === "T33" ? "Outside address text" : id === "T34" ? "Indore address text" : address;
    await setDestination(city, shop);
    const orderId = await submit(input, await quote(input));
    const documents = await readCompanyOrders(orderId);
    const expected = new Map<string, number>();
    for (const item of items(input)) expected.set(item.variantId, (expected.get(item.variantId) ?? 0) + item.qty);
    const expectedRows = [...expected].map(([variantId, qty]) => [
      labels.get(variantId)!, qty, padam.split(" ").includes(labels.get(variantId)!) ? PI : JT,
    ]).sort();
    const actualRows = documents.flatMap(doc => doc.items.map(item => [labels.get(item.variantId), item.qtyOrdered, doc.company])).sort();
    expect(actualRows).toEqual(expectedRows);
    expect(documents).toHaveLength(count);
    expect(documents.every(doc => doc.items.length > 0 && doc.deliveryCity === city && doc.deliveryAddress === shop)).toBe(true);
    expect(new Set(documents.map(doc => doc.reference)).size).toBe(count);
  });
});

describe("company order lifecycle", () => {
  it("rejects unresolved metadata and invalidates quotes after the delivery changes", async () => {
    const input = "LT:1 R:5";
    await setDestination(null);
    await expect(quote(input)).rejects.toMatchObject({ code: "ROUTING_DESTINATION_REQUIRED" });
    await setDestination(outside);
    await expect(quote("LT:1 LEG:5")).rejects.toMatchObject({ code: "ROUTING_CLASS_REQUIRED" });
    const commercial = await quote(input);
    await setDestination("Indore");
    const result = await createOrderForRetailer(retailerId, items(input), "retailer", undefined, undefined, randomUUID(), commercial);
    expect(result).toMatchObject({ ok: false, status: 409, body: { reason: "routing_inputs_changed" } });
    expect(await prisma.order.count({ where: { commercialQuoteId: commercial.quoteId } })).toBe(0);
  });

  it("rolls back the source order and first document if the second company write fails", async () => {
    const input = "LT:1 R:5";
    await setDestination(outside, "Synthetic company order rollback");
    const commercial = await quote(input);
    const key = randomUUID();
    await prisma.$executeRawUnsafe(`CREATE FUNCTION test_company_order_rollback() RETURNS trigger AS $$
      BEGIN
        IF NEW."deliveryAddress" = 'Synthetic company order rollback'
          AND EXISTS (SELECT FROM "CompanySalesOrder" WHERE "orderId" = NEW."orderId")
        THEN RAISE EXCEPTION 'synthetic second company write failure';
        END IF;
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql`);
    try {
      await prisma.$executeRawUnsafe(`CREATE TRIGGER test_company_order_rollback BEFORE INSERT ON "CompanySalesOrder"
        FOR EACH ROW EXECUTE FUNCTION test_company_order_rollback()`);
      try {
        await expect(submit(input, commercial, key)).rejects.toThrow("synthetic second company write failure");
        expect(await prisma.order.count({ where: { retailerId, idempotencyKey: key } })).toBe(0);
        expect(await prisma.companySalesOrder.count({ where: { deliveryAddress: "Synthetic company order rollback" } })).toBe(0);
        expect((await prisma.commercialQuote.findUniqueOrThrow({ where: { id: commercial.quoteId } })).acceptedAt).toBeNull();
      } finally {
        await prisma.$executeRawUnsafe('DROP TRIGGER test_company_order_rollback ON "CompanySalesOrder"');
      }
    } finally {
      await prisma.$executeRawUnsafe("DROP FUNCTION test_company_order_rollback()");
    }
    const [first, second] = await Promise.all([submit(input, commercial, key), submit(input, commercial, key)]);
    expect(first).toBe(second);
    expect(await readCompanyOrders(first)).toHaveLength(2);
  });

  it("separates warehouse routes and SAP acknowledgments for an authenticated rep checkout", async () => {
    await setDestination(outside);
    const input = "LT:1 R:5";
    const rep = `Bearer ${repToken}`;
    const admin = `Bearer ${adminToken}`;
    const quoteResponse = await request(server).post("/rep/commercial/quotes").set("Authorization", rep)
      .send({ retailerId, items: items(input) }).expect(200);
    const { id: quoteId, revision } = quoteResponse.body.quote;
    const staff = await prisma.staffUser.findFirstOrThrow({ where: { adminUserId: { not: null } } });
    const priced = await setFreight(quoteId, revision, {
      entity: PI, amount: "100.00", gstPercent: "18", recordedQuintals: "1.50", recordedKilometres: "5",
    }, staff.id);
    const checkout = await request(server).post("/rep/orders").set("Authorization", rep).set("Idempotency-Key", randomUUID())
      .send({ retailerId, items: items(input), commercial: { quoteId, revision: priced.revision } }).expect(201);
    const orderId = checkout.body.order.id as string;
    const documents = await readCompanyOrders(orderId);
    const warehouse = `/admin/warehouse-orders/${orderId}`;
    await request(server).post(`${warehouse}/pack`).set("Authorization", admin).expect(200);
    const jobs = await prisma.sapOutbox.findMany({ where: { referenceId: { in: documents.map(document => document.id) } } });
    expect(jobs).toHaveLength(2);
    for (const doc of documents) {
      expect(jobs.find(job => job.referenceId === doc.id)?.payload).toMatchObject({
        company: doc.company, companySalesOrderId: doc.id, externalReference: doc.reference,
        lines: [{ quantityCases: doc.company === JT ? 1 : 5 }],
      });
    }
    await request(server).post(`${warehouse}/dispatch`).set("Authorization", admin)
      .send({ routeId: "ONE-ROUTE" }).expect(409);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("packed");
    expect(await prisma.dispatchAuthorization.count({ where: { orderId, status: "active" } })).toBe(1);
    const companyRoutes = documents.map(doc => ({ companySalesOrderId: doc.id, routeId: doc.company === JT ? "ROUTE-JT" : "ROUTE-PI" }));
    await request(server).post(`${warehouse}/dispatch`).set("Authorization", admin).send({ companyRoutes }).expect(200);
    expect((await readCompanyOrders(orderId)).map(doc => doc.routeId)).toEqual(["ROUTE-JT", "ROUTE-PI"]);
    const mock = new MockSapConnector();
    const post = vi.spyOn(mock, "postSalesOrder");
    await Promise.all([drainOutbox(2, mock, orderId), drainOutbox(2, mock, orderId)]);
    expect(post).toHaveBeenCalledTimes(2);
    const sent = await readCompanyOrders(orderId);
    expect(sent.every(doc => doc.sapSyncStatus === "sent")).toBe(true);
    expect(new Set(sent.map(doc => doc.sapSalesOrderId)).size).toBe(2);
    const proof = {
      podType: "signature",
      transportationAmount: 125,
      transportationEntity: PI,
      items: sent.flatMap(doc => doc.items.map(line => ({ orderItemId: line.id, qtyDelivered: line.qtyOrdered }))),
    };
    const before = (await prisma.retailer.findUniqueOrThrow({ where: { id: retailerId } })).currentBalance;
    await request(server).post(`${warehouse}/deliver`).set("Authorization", admin).send({ ...proof, transportationEntity: JT }).expect(409);
    expect(await prisma.invoice.count({ where: { orderId } })).toBe(0);
    const [delivery, replay] = await Promise.all(Array.from({ length: 2 }, () =>
      request(server).post(`${warehouse}/deliver`).set("Authorization", admin).send(proof).expect(200)));
    expect(delivery.body.invoices.map((document: { id: string }) => document.id).sort())
      .toEqual(replay.body.invoices.map((document: { id: string }) => document.id).sort());
    await request(server).post(`${warehouse}/deliver`).set("Authorization", admin).send({ ...proof, transportationAmount: 126 }).expect(409);

    const bills = await prisma.invoice.findMany({
      where: { orderId }, include: { lines: true, ledgerEntry: true, legacyLedgerEntry: true },
      orderBy: { sellingEntity: "asc" },
    });
    expect(bills.map(bill => [bill.sellingEntity, bill.total.toFixed(2), bill.taxTotal.toFixed(2)])).toEqual([
      [JT, "3150.00", "150.00"], [PI, "15897.50", "772.50"],
    ]);
    expect(bills.map(bill => bill.companySalesOrderId)).toEqual(sent.map(doc => doc.id));
    expect(bills.map(bill => bill.firmInvoiceNumber?.slice(0, 2))).toEqual(["JT", "PI"]);
    expect(bills.every(bill => bill.lines.every(line => line.sellingEntity === bill.sellingEntity))).toBe(true);
    expect(bills.every(bill => bill.ledgerEntry?.amount.eq(bill.total) && bill.legacyLedgerEntry?.amount.eq(bill.total))).toBe(true);
    const after = (await prisma.retailer.findUniqueOrThrow({ where: { id: retailerId } })).currentBalance;
    expect(after.minus(before).toFixed(2)).toBe("19047.50");
    expect(await prisma.sapOutbox.count({ where: { referenceId: { in: bills.map(bill => bill.legacyLedgerEntryId!) } } })).toBe(0);
    await request(server).get(`${warehouse}/invoice-pdf`).set("Authorization", admin).expect(409);
    await request(server).get(`${warehouse}/invoice-pdf`).query({ invoiceId: bills[1].id }).set("Authorization", admin)
      .expect("Content-Type", /pdf/).expect("Content-Disposition", /Invoice-PI-/).expect(200);
    await request(server).get(`/admin/orders/${orderId}/invoice-pdf`).query({ invoiceId: bills[0].id }).set("Authorization", admin)
      .expect("Content-Type", /pdf/).expect("Content-Disposition", /Invoice-JT-/).expect(200);
    for (const [path, token] of [[`/orders/${orderId}`, `Bearer ${retailerToken}`], [`/rep/orders/${orderId}`, rep]]) {
      const response = await request(server).get(path).set("Authorization", token).expect(200);
      expect(response.body.order.invoice).toBeNull();
      expect(response.body.order.invoices.map((bill: { firmInvoiceNumber: string }) => bill.firmInvoiceNumber).sort())
        .toEqual(bills.map(bill => bill.firmInvoiceNumber).sort());
    }
    expect((await readCompanyOrders(orderId)).every(doc => doc.deliveredAt)).toBe(true);
  });

  it("records an undelivered firm's quantities without issuing an empty invoice", async () => {
    await setDestination(outside);
    const input = "LT:1 R:5";
    const orderId = await submit(input, await quote(input));
    const documents = await readCompanyOrders(orderId);
    await prisma.order.update({ where: { id: orderId }, data: { status: "out_for_delivery" } });
    await prisma.companySalesOrder.updateMany({ where: { orderId }, data: { dispatchedAt: new Date(), routeId: "TEST" } });
    const request = {
      orderId,
      occurredAt: new Date(),
      idempotencyKey: `delivery:${orderId}`,
      lines: documents.flatMap(document => document.items.map(item => ({
        orderItemId: item.id, deliveredCases: document.company === JT ? 0 : item.qtyOrdered,
      }))),
    };
    const billed = await createInvoiceForDelivery(request);
    expect(billed.invoices).toHaveLength(1);
    expect(billed.sellingEntity).toBe(PI);
    expect((await createInvoiceForDelivery(request)).id).toBe(billed.id);
    expect((await readCompanyOrders(orderId)).find(document => document.company === JT)?.deliveredAt).toBeNull();
  });

  it("issues each firm's invoice when its own delivery is recorded", async () => {
    await setDestination(outside);
    const input = "LT:1 R:5";
    const orderId = await submit(input, await quote(input));
    const [jain, padam] = await readCompanyOrders(orderId);
    await prisma.order.update({ where: { id: orderId }, data: { status: "out_for_delivery" } });
    await prisma.companySalesOrder.updateMany({ where: { orderId }, data: { dispatchedAt: new Date(), routeId: "TEST" } });
    const requestFor = (document: typeof jain) => ({
      orderId,
      companySalesOrderId: document.id,
      occurredAt: new Date(),
      idempotencyKey: `delivery:${orderId}:${document.id}`,
      lines: document.items.map(item => ({ orderItemId: item.id, deliveredCases: item.qtyOrdered })),
    });
    const jainRequest = requestFor(jain);
    const first = await createInvoiceForDelivery(jainRequest);
    expect(first.invoices.map(invoice => invoice.sellingEntity)).toEqual([JT]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("out_for_delivery");
    await expect(createInvoiceForDelivery({
      ...jainRequest, companySalesOrderId: undefined, idempotencyKey: `delivery:${orderId}`,
      lines: [...jainRequest.lines, ...requestFor(padam).lines],
    })).rejects.toMatchObject({ code: "company_delivery_selection_required" });
    const second = await createInvoiceForDelivery(requestFor(padam));
    expect(second.sellingEntity).toBe(PI);
    expect(second.invoices.map(invoice => invoice.sellingEntity)).toEqual([JT, PI]);
    expect((await createInvoiceForDelivery(jainRequest)).id).toBe(first.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("delivered");
  });

  it("requires review before a routed cart accepts a discount without an approved firm allocation", async () => {
    await setDestination(outside);
    const input = "LT:1 R:5";
    const commercial = await quote(input);
    const result = await createOrderForRetailer(
      retailerId, items(input), "retailer", undefined, undefined, randomUUID(), commercial, "SPECIAL100",
    );
    expect(result).toMatchObject({ ok: false, status: 409, body: { error: "company_invoice_discount_review_required" } });
    expect(await prisma.order.count({ where: { commercialQuoteId: commercial.quoteId } })).toBe(0);
  });

  it("blocks issued accounting edits before writing item quantities", async () => {
    await setDestination(outside);
    const input = "R:4";
    const commercial = await quote(input);
    const checkout = await request(server).post("/orders").set("Authorization", `Bearer ${retailerToken}`)
      .set("Idempotency-Key", randomUUID()).send({ items: items(input), commercial }).expect(201);
    const orderId = checkout.body.order.id;
    const [document] = await readCompanyOrders(orderId);
    await request(server).put(`/admin/orders/${orderId}`).set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [{ orderItemId: document.items[0].id, qtyOrdered: 5 }] })
      .expect(409, { error: "accepted_order_amendment_required" });
    expect((await readCompanyOrders(orderId))[0].items[0].qtyOrdered).toBe(4);
  });

  it("uses the same split for manual and automatic approved proposal conversion", async () => {
    await setDestination(outside);
    const staff = await prisma.staffUser.findFirstOrThrow({ where: { salesRepId: { not: null } } });
    const proposal = await prisma.retailerProposal.create({
      data: {
        retailerId, status: "approved", submittedByStaffId: staff.id, businessName: "Approved test proposal",
        phone: retailerId, shopAddress: address, deliveryCity: outside,
      },
    });
    const input = "LT:1 R:5";
    const createIntent = () => prisma.retailerProposalOrderIntent.create({
      data: {
        proposalId: proposal.id, submittedByStaffId: staff.id, idempotencyKey: randomUUID(),
        items: { create: items(input).map(line => ({ ...line, productName: labels.get(line.variantId)!, unitSize: "30kg", unitsPerCase: 1 })) },
      },
    });
    const manual = await createIntent();
    const converted = await request(server).post(`/rep/retailer-proposal-order-intents/${manual.id}/convert`)
      .set("Authorization", `Bearer ${repToken}`).send({ commercial: await quote(input) }).expect(201);
    expect((await readCompanyOrders(converted.body.order.id)).map(document => document.company)).toEqual([JT, PI]);
    const auto = await createIntent();
    const service = new RetailerProposalService();
    const params = { proposalId: proposal.id, retailerId, salespersonStaffId: staff.id, salesRepId: staff.salesRepId };
    const autoConverted = await service.autoConvertPendingIntents(params);
    const linked = await prisma.retailerProposalOrderIntent.findUniqueOrThrow({ where: { id: auto.id } });
    expect(autoConverted).toHaveLength(1);
    expect(linked.convertedOrderId).toBe(autoConverted[0].id);
    expect((await readCompanyOrders(linked.convertedOrderId!)).map(document => document.company)).toEqual([JT, PI]);
    expect(await service.autoConvertPendingIntents(params)).toEqual([]);
  });

  it("bills a free pack to the firm that earned it without changing the money due", async () => {
    const pack = await prisma.variant.findUniqueOrThrow({ where: { id: variants.get("PROMO_RICE")! } });
    await prisma.variant.create({
      data: { productId: pack.productId, unitSize: "1kg", unit: "kg", unitsPerCase: 1, unitWeightKg: 1 },
    });
    const admin = `Bearer ${adminToken}`;
    const input = "LT:1 PROMO_RICE:7";
    await setDestination(outside);
    const outsideOrder = await submit(input, await quote(input));
    await request(server).post(`/admin/orders/${outsideOrder}/approve`).set("Authorization", admin).expect(200);
    await request(server).post(`/admin/commercial-status/orders/${outsideOrder}/toggle-code`).set("Authorization", admin)
      .send({ code: "SALES_ORDER_CREATED", active: true }).expect(409);
    expect(await prisma.commercialStatusEvent.count({ where: { orderId: outsideOrder, code: "SALES_ORDER_CREATED" } })).toBe(0);
    const documents = await readCompanyOrders(outsideOrder);
    expect(documents.find(doc => doc.company === PI)?.items.some(item => item.unitPrice.eq(0))).toBe(true);
    expect(documents.find(doc => doc.company === JT)?.items.every(item => item.unitPrice.gt(0))).toBe(true);
    await request(server).post(`/admin/warehouse-orders/${outsideOrder}/pack`).set("Authorization", admin).expect(200);

    await setDestination("Indore");
    const indoreOrder = await submit(input, await quote(input));
    await request(server).post(`/admin/orders/${indoreOrder}/approve`).set("Authorization", admin).expect(200);
    const warehouse = `/admin/warehouse-orders/${indoreOrder}`;
    await request(server).post(`${warehouse}/pack`).set("Authorization", admin).expect(200);
    await request(server).post(`${warehouse}/dispatch`).set("Authorization", admin).send({ routeId: "INDORE-JT" }).expect(200);
    const [document] = await readCompanyOrders(indoreOrder);
    const bonus = document.items.find(item => item.unitPrice.eq(0));
    expect(bonus).toBeDefined();
    await request(server).post(`${warehouse}/deliver`).set("Authorization", admin).send({
      podType: "signature",
      items: document.items.map(line => ({ orderItemId: line.id, qtyDelivered: line.qtyOrdered })),
    }).expect(200);
    expect(document.company).toBe(JT);
    const bonusInvoiceLine = await prisma.invoiceLine.findFirstOrThrow({
      where: { orderItemId: bonus!.id }, include: { invoice: { select: { sellingEntity: true } } },
    });
    expect(bonusInvoiceLine.invoice.sellingEntity).toBe(JT);
    expect(bonusInvoiceLine.lineTotal.eq(0)).toBe(true);
  });
});
