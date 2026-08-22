import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { scheduleRecoveryActions } from "../scheduler";

const ids = { tier: randomUUID(), retailer: randomUUID(), order: randomUUID(), invoice: randomUUID() };
const now = new Date("2026-08-21T00:00:00.000Z");
const invoiceDate = new Date("2026-06-22T00:00:00.000Z"); // 60 days old

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `recovery-${ids.tier}` } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "Recovery Shop", phone: `7${Date.now().toString().slice(-9)}`, shopAddress: "Test", tierId: ids.tier } });
  await prisma.order.create({ data: { id: ids.order, retailerId: ids.retailer, status: "delivered", orderTotal: 1000 } });
  await prisma.invoice.create({ data: { id: ids.invoice, retailerId: ids.retailer, orderId: ids.order, invoiceDate, dueDate: new Date("2026-07-07T00:00:00.000Z"), subtotal: 1000, total: 1000, outstandingAmount: 1000, idempotencyKey: randomUUID() } });
});

afterAll(async () => {
  await prisma.recoveryAction.deleteMany({ where: { recoveryCase: { invoiceId: ids.invoice } } });
  await prisma.recoveryCase.deleteMany({ where: { invoiceId: ids.invoice } });
  await prisma.invoice.delete({ where: { id: ids.invoice } });
  await prisma.order.delete({ where: { id: ids.order } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("recovery scheduler", () => {
  it("catches up all reached age bands and remains idempotent", async () => {
    const first = await scheduleRecoveryActions({ now });
    expect(first).toEqual({ considered: 1, casesCreated: 1, actionsCreated: 6 });
    expect(await prisma.recoveryAction.count({ where: { caseId: (await prisma.recoveryCase.findUniqueOrThrow({ where: { invoiceId: ids.invoice } })).id } })).toBe(6);

    const second = await scheduleRecoveryActions({ now: new Date("2026-08-21T01:00:00.000Z") });
    expect(second).toEqual({ considered: 1, casesCreated: 0, actionsCreated: 0 });
  });

  it("does not schedule paid or voided invoices", async () => {
    await prisma.invoice.update({ where: { id: ids.invoice }, data: { status: "paid", outstandingAmount: 0 } });
    expect(await scheduleRecoveryActions({ now })).toMatchObject({ considered: 0, actionsCreated: 0 });
  });
});
