import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { RecoveryService } from "../recoveryService";

const ids = { tier: randomUUID(), retailer: randomUUID(), order: randomUUID(), invoice: randomUUID(), staff: randomUUID() };
const service = new RecoveryService();

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `commitments-${ids.tier}` } });
  await prisma.retailer.create({ data: { id: ids.retailer, name: "Promise Shop", phone: `7${Date.now().toString().slice(-9)}`, shopAddress: "Test", tierId: ids.tier } });
  await prisma.order.create({ data: { id: ids.order, retailerId: ids.retailer, status: "delivered", orderTotal: 1000 } });
  await prisma.invoice.create({ data: { id: ids.invoice, retailerId: ids.retailer, orderId: ids.order, invoiceDate: new Date("2026-06-01T00:00:00.000Z"), dueDate: new Date("2026-06-16T00:00:00.000Z"), subtotal: 1000, total: 1000, outstandingAmount: 1000, idempotencyKey: randomUUID() } });
  await prisma.recoveryCase.create({ data: { invoiceId: ids.invoice, retailerId: ids.retailer } });
});

afterAll(async () => {
  await prisma.promiseToPay.deleteMany({ where: { recoveryCase: { invoiceId: ids.invoice } } });
  await prisma.callLog.deleteMany({ where: { recoveryCase: { invoiceId: ids.invoice } } });
  await prisma.recoveryAction.deleteMany({ where: { recoveryCase: { invoiceId: ids.invoice } } });
  await prisma.recoveryCase.deleteMany({ where: { invoiceId: ids.invoice } });
  await prisma.invoice.delete({ where: { id: ids.invoice } });
  await prisma.order.delete({ where: { id: ids.order } });
  await prisma.retailer.delete({ where: { id: ids.retailer } });
  await prisma.tier.delete({ where: { id: ids.tier } });
});

describe("recovery commitments and timeline", () => {
  it("logs a call idempotently and returns it in the case timeline", async () => {
    const input = { caseId: (await prisma.recoveryCase.findUniqueOrThrow({ where: { invoiceId: ids.invoice } })).id, actorStaffId: ids.staff, actorPermissions: ["recovery.update"], outcome: "spoke_with_customer" as const, notes: "Customer will pay after market day.", idempotencyKey: `call-${randomUUID()}` };
    const first = await service.logCall(input);
    const second = await service.logCall(input);
    expect(first.id).toBe(second.id);
    const timeline = await service.timeline(input.caseId, ["recovery.view"]);
    expect(timeline.events).toHaveLength(1);
    expect(timeline.events[0]).toMatchObject({ kind: "call", notes: input.notes });
  });

  it("supersedes an older promise and records kept/missed transitions", async () => {
    const caseId = (await prisma.recoveryCase.findUniqueOrThrow({ where: { invoiceId: ids.invoice } })).id;
    const firstDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const secondDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const first = await service.createPromise({ caseId, actorStaffId: ids.staff, actorPermissions: ["recovery.update"], amount: 400, dueAt: firstDueAt, idempotencyKey: `promise-${randomUUID()}` });
    const second = await service.createPromise({ caseId, actorStaffId: ids.staff, actorPermissions: ["recovery.update"], amount: 600, dueAt: secondDueAt, idempotencyKey: `promise-${randomUUID()}` });
    expect(first.status).toBe("promised");
    expect(await prisma.promiseToPay.findUnique({ where: { id: first.id } })).toMatchObject({ status: "superseded" });
    await expect(service.setPromiseStatus(second.id, "kept", { actorStaffId: ids.staff, actorPermissions: ["recovery.update"] })).resolves.toMatchObject({ status: "kept" });
    await expect(service.setPromiseStatus(second.id, "missed", { actorStaffId: ids.staff, actorPermissions: ["recovery.update"] })).rejects.toMatchObject({ code: "promise_terminal" });
  });
});
