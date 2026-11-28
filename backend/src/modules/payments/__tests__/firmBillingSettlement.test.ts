import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { CollectionService } from "../../collections/collectionService";
import { postInvoicePayment } from "../../commercial/payment";
import { invoiceBalances } from "../../commercial/service";
import { buildCreditSnapshot } from "../../credit/snapshotBuilder";
import { financialInvoiceProjectionFor, financialLedgerFor, retailerPaymentInvoicesFor } from "../../finance/financialQueries";
import { issueCreditNote } from "../creditNoteService";
import { settleSucceededPayment } from "../paymentService";
import { reversePayment } from "../reversalService";

const retailerId = randomUUID();
const tierId = randomUUID();
const actorStaffId = randomUUID();
const orderId = randomUUID();
const invoiceDate = new Date("2026-11-10T10:00:00Z");
const dueDate = new Date("2026-11-25T10:00:00Z");
let jainInvoiceId: string;
let padamInvoiceId: string;
let safeDatabase = false;

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.includes("test")) {
    throw new Error("Disposable local test database required");
  }
  safeDatabase = true;
  await prisma.tier.create({ data: { id: tierId, name: `Firm settlement ${tierId}` } });
  await prisma.staffUser.create({
    data: { id: actorStaffId, name: "Firm test accounts", phone: actorStaffId, email: `${actorStaffId}@example.invalid` },
  });
  await prisma.retailer.create({
    data: { id: retailerId, tierId, name: "Firm settlement test", phone: retailerId, shopAddress: "Test address", currentBalance: 700 },
  });
  await prisma.collectionAssignment.create({ data: { collectorStaffId: actorStaffId, retailerId } });
  await prisma.order.create({ data: { id: orderId, retailerId, orderTotal: 700, status: "delivered" } });
  for (const [company, total, balanceAfter, prefix] of [
    ["jain_traders", 300, 300, "JT"],
    ["padam_international", 400, 700, "PI"],
  ] as const) {
    const companyOrder = await prisma.companySalesOrder.create({
      data: { orderId, company, reference: `${orderId}-${prefix}`, deliveryCity: "Bhopal", deliveryAddress: "Test address" },
    });
    const legacyLedger = await prisma.ledgerEntry.create({
      data: { orderId, retailerId, type: "invoice", amount: total, balanceAfter, dueDate },
    });
    const firmInvoiceNumber = `${prefix}/2627/TEST-${companyOrder.id}`;
    const invoice = await prisma.invoice.create({
      data: {
        orderId, retailerId, sellingEntity: company, companySalesOrderId: companyOrder.id, firmInvoiceNumber,
        invoiceDate, dueDate, subtotal: total, total, outstandingAmount: total, legacyLedgerEntryId: legacyLedger.id,
        idempotencyKey: `test-firm-invoice:${companyOrder.id}`,
        commercialSnapshot: { entities: [{ entity: company, total: total.toFixed(2) }] },
        billingSnapshot: { seller: { name: company }, buyer: { name: "Firm settlement test" } },
      },
    });
    await prisma.financialLedgerEntry.create({
      data: { retailerId, invoiceId: invoice.id, amount: total, balanceAfter, kind: "invoice", direction: "debit",
        idempotencyKey: `test-firm-ledger:${invoice.id}`, occurredAt: invoiceDate },
    });
    if (company === "jain_traders") jainInvoiceId = invoice.id;
    else padamInvoiceId = invoice.id;
  }
});

afterAll(async () => {
  if (!safeDatabase) return;
  await prisma.auditEvent.deleteMany({ where: { actorStaffId } });
  await prisma.commercialStatusEvent.deleteMany({ where: { retailerId } });
  await prisma.collectionSubmission.deleteMany({ where: { retailerId } });
  await prisma.collectionAssignment.deleteMany({ where: { retailerId } });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId } });
  await prisma.paymentReversalAllocation.deleteMany({ where: { paymentReversal: { payment: { retailerId } } } });
  await prisma.paymentReversal.deleteMany({ where: { payment: { retailerId } } });
  await prisma.paymentAllocation.deleteMany({ where: { payment: { retailerId } } });
  await prisma.payment.deleteMany({ where: { retailerId } });
  await prisma.creditNote.deleteMany({ where: { retailerId } });
  await prisma.invoice.deleteMany({ where: { retailerId } });
  await prisma.ledgerEntry.deleteMany({ where: { retailerId } });
  await prisma.order.deleteMany({ where: { id: orderId } });
  await prisma.retailer.deleteMany({ where: { id: retailerId } });
  await prisma.staffUser.deleteMany({ where: { id: actorStaffId } });
  await prisma.tier.deleteMany({ where: { id: tierId } });
});

it("keeps settlement, credit, reversal and mirrored balances on the firm invoice", async () => {
  const collection = new CollectionService();
  const collectionInput = {
    amount: 10, method: "cash" as const, reference: "firm-collection-test", retailerId,
    collectorStaffId: actorStaffId, actorPermissions: ["collection.submit"],
  };
  await expect(collection.submit({ ...collectionInput, idempotencyKey: randomUUID() }))
    .rejects.toMatchObject({ code: "invoice_entity_allocation_required" });
  await expect(collection.submit({
    ...collectionInput, idempotencyKey: randomUUID(), invoiceScopeId: padamInvoiceId, jainAmount: "10", padamAmount: "0",
  })).rejects.toMatchObject({ code: "invoice_entity_allocation_invalid" });
  const unscoped = await prisma.payment.create({ data: { retailerId, amount: 10 } });
  await expect(settleSucceededPayment({ paymentId: unscoped.id, occurredAt: invoiceDate }))
    .rejects.toMatchObject({ code: "invoice_entity_allocation_required" });

  const payment = {
    invoiceId: jainInvoiceId, amount: "80.00", jainAmount: "80.00", padamAmount: "0.00",
    method: "cash", reference: "firm-payment-test", confirmed: true as const,
  };
  const invalidKey = randomUUID();
  await expect(postInvoicePayment(retailerId, actorStaffId, invalidKey, { ...payment, invoiceId: padamInvoiceId }))
    .rejects.toMatchObject({ code: "invoice_entity_allocation_invalid" });
  expect(await prisma.payment.findUnique({ where: { requestKey: invalidKey } })).toBeNull();
  const paymentKey = randomUUID();
  const settled = await postInvoicePayment(retailerId, actorStaffId, paymentKey, payment);
  expect(settled.allocations).toEqual([{ invoiceId: jainInvoiceId, amount: 80 }]);
  expect(await postInvoicePayment(retailerId, actorStaffId, paymentKey, payment)).toMatchObject({ idempotent: true });

  const correction = { actorStaffId, occurredAt: invoiceDate };
  await reversePayment({ ...correction, paymentId: settled.paymentId, amount: 30, reason: "Duplicate cash entry", idempotencyKey: randomUUID() });
  await expect(issueCreditNote({
    ...correction, invoiceId: jainInvoiceId, amount: 251, reason: "Firm adjustment", idempotencyKey: randomUUID(),
  })).rejects.toMatchObject({ code: "firm_credit_exceeds_invoice_outstanding" });
  await issueCreditNote({
    ...correction, invoiceId: jainInvoiceId, amount: 25, reason: "Firm adjustment", idempotencyKey: randomUUID(),
  });

  const [jain, padam] = await prisma.$transaction(async tx => [
    await invoiceBalances(tx, jainInvoiceId),
    await invoiceBalances(tx, padamInvoiceId),
  ]);
  expect([jain.jain.toFixed(2), jain.padam.toFixed(2), padam.jain.toFixed(2), padam.padam.toFixed(2)])
    .toEqual(["225.00", "0.00", "0.00", "400.00"]);
  const mirrored = await prisma.ledgerEntry.findMany({
    where: { id: { in: [jain.invoice.legacyLedgerEntryId!, padam.invoice.legacyLedgerEntryId!] } },
    orderBy: { amount: "asc" },
  });
  expect(mirrored.map(entry => entry.settledAmount.toFixed(2))).toEqual(["75.00", "0.00"]);
  expect((await prisma.retailer.findUniqueOrThrow({ where: { id: retailerId } })).currentBalance.toFixed(2)).toBe("625.00");
  expect(await financialInvoiceProjectionFor(prisma, retailerId)).toMatchObject({
    entityBalances: {
      outstanding: { jainTraders: 225, padamInternational: 400, unattributed: 0 },
      attributionStatus: "complete",
    },
  });
  const ledger = await financialLedgerFor(prisma, retailerId);
  expect(ledger.find(entry => entry.kind === "credit_note")?.entityBreakdown)
    .toMatchObject({ jainTraders: 25, padamInternational: 0, attributionStatus: "complete" });
  expect(ledger.find(entry => entry.kind === "payment_reversal")?.entityBreakdown)
    .toMatchObject({ jainTraders: 30, padamInternational: 0, attributionStatus: "complete" });
  expect((await retailerPaymentInvoicesFor(prisma, retailerId)).paymentInvoices)
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ id: jainInvoiceId, firmInvoiceNumber: expect.stringMatching(/^JT/), sellingEntity: "jain_traders", paymentEligible: true }),
      expect.objectContaining({ id: padamInvoiceId, firmInvoiceNumber: expect.stringMatching(/^PI/), sellingEntity: "padam_international", paymentEligible: true }),
    ]));
  expect(await prisma.$transaction(tx => buildCreditSnapshot(tx, retailerId, invoiceDate))).toMatchObject({
    invoiceCount: 1,
    openInvoices: [expect.objectContaining({ total: 700, outstandingAmount: 625 })],
    outstandingAmount: 625,
  });
});
