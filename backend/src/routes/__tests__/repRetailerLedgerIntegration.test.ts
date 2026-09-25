import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { lazyIdentitySessionService } from "../../modules/identity/sessionRuntime";

const ids = {
  tier: randomUUID(),
  repA: randomUUID(),
  repB: randomUUID(),
  staffA: randomUUID(),
  staffB: randomUUID(),
  retailerA: randomUUID(),
  retailerB: randomUUID(),
};

let tokenA = "";
let tokenB = "";
const app = createApp();

beforeAll(async () => {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "platform_admin" } });
  await prisma.tier.create({ data: { id: ids.tier, name: `rep-ledger-${ids.tier}` } });
  await prisma.salesRep.createMany({
    data: [
      { id: ids.repA, name: "Ledger Rep A", phone: `1${Date.now().toString().slice(-9)}` },
      { id: ids.repB, name: "Ledger Rep B", phone: `2${Date.now().toString().slice(-9)}` },
    ],
  });
  await prisma.staffUser.createMany({
    data: [
      { id: ids.staffA, name: "Ledger Staff A", phone: `3${Date.now().toString().slice(-9)}`, email: `${ids.staffA}@test.invalid`, salesRepId: ids.repA },
      { id: ids.staffB, name: "Ledger Staff B", phone: `4${Date.now().toString().slice(-9)}`, email: `${ids.staffB}@test.invalid`, salesRepId: ids.repB },
    ],
  });
  await prisma.staffRole.createMany({
    data: [
      { staffId: ids.staffA, roleId: role.id },
      { staffId: ids.staffB, roleId: role.id },
    ],
  });
  await prisma.retailer.createMany({
    data: [
      { id: ids.retailerA, name: "Ledger Retailer A", phone: ids.retailerA, shopAddress: "Local", tierId: ids.tier, salesRepId: ids.repA, creditLimit: 1_000, currentBalance: 175, overdueAmount: 175 },
      { id: ids.retailerB, name: "Ledger Retailer B", phone: ids.retailerB, shopAddress: "Local", tierId: ids.tier, salesRepId: ids.repB, creditLimit: 1_000, currentBalance: 0, overdueAmount: 0 },
    ],
  });

  const invoices = [
    { amount: 100, entity: "jain_traders" },
    { amount: 50, entity: "padam_international" },
    { amount: 25, entity: null },
  ];
  let balance = 0;
  for (const [index, item] of invoices.entries()) {
    balance += item.amount;
    const invoiceId = randomUUID();
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        retailerId: ids.retailerA,
        invoiceDate: new Date("2026-08-01T00:00:00.000Z"),
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        subtotal: item.amount,
        total: item.amount,
        outstandingAmount: item.amount,
        status: "open",
        ...(item.entity
          ? { commercialSnapshot: { entities: [{ entity: item.entity, total: item.amount.toFixed(2) }] } }
          : {}),
        idempotencyKey: `${invoiceId}-key`,
      },
    });
    await prisma.financialLedgerEntry.create({
      data: {
        retailerId: ids.retailerA,
        invoiceId,
        direction: "debit",
        kind: "invoice",
        amount: item.amount,
        balanceAfter: balance,
        idempotencyKey: `${invoiceId}-ledger-${index}`,
        occurredAt: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
      },
    });
  }

  const [sessionA, sessionB] = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staffA, deviceName: "rep-ledger-test" }),
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staffB, deviceName: "rep-ledger-test" }),
  ]);
  tokenA = sessionA.accessToken;
  tokenB = sessionB.accessToken;
});

afterAll(async () => {
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: [ids.staffA, ids.staffB] } } });
  await prisma.financialLedgerEntry.deleteMany({ where: { retailerId: ids.retailerA } });
  await prisma.invoice.deleteMany({ where: { retailerId: ids.retailerA } });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: [ids.staffA, ids.staffB] } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: [ids.repA, ids.repB] } } });
  await prisma.tier.deleteMany({ where: { id: ids.tier } });
});

describe("Rep retailer financial ledger", () => {
  it("returns reconciled pages only to the assigned salesperson and handles empty ledgers", async () => {
    await request(app).get(`/rep/retailers/${ids.retailerA}/ledger`).expect(401);
    await request(app)
      .get(`/rep/retailers/${ids.retailerA}/ledger`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);

    const first = await request(app)
      .get(`/rep/retailers/${ids.retailerA}/ledger?limit=2`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    expect(first.body.financialSummary).toMatchObject({
      outstanding: 175,
      overdue: 175,
      entityBalances: {
        outstanding: { jainTraders: 100, padamInternational: 50, unattributed: 25 },
        overdue: { jainTraders: 100, padamInternational: 50, unattributed: 25 },
        attributionStatus: "contains_unattributed",
      },
    });
    expect(first.body.entries).toHaveLength(2);
    expect(first.body.entries[0].entityBreakdown).toMatchObject({
      jainTraders: 0,
      padamInternational: 0,
      unattributed: 25,
      attributionStatus: "contains_unattributed",
    });
    expect(first.body.entries[1].entityBreakdown).toMatchObject({
      jainTraders: 0,
      padamInternational: 50,
      unattributed: 0,
      attributionStatus: "complete",
    });
    expect(first.body.nextCursor).toBe(first.body.entries[1].sequence);

    const second = await request(app)
      .get(`/rep/retailers/${ids.retailerA}/ledger?limit=2&beforeSequence=${first.body.nextCursor}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(second.body.entries).toHaveLength(1);
    expect(second.body.entries[0].entityBreakdown).toMatchObject({
      jainTraders: 100,
      padamInternational: 0,
      unattributed: 0,
      attributionStatus: "complete",
    });
    expect(second.body.nextCursor).toBeNull();
    expect(new Set([...first.body.entries, ...second.body.entries].map((entry: any) => entry.sequence)).size).toBe(3);

    await request(app)
      .get(`/rep/retailers/${ids.retailerA}/ledger?beforeSequence=invalid`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(400);
    await request(app)
      .get(`/rep/retailers/${ids.retailerA}/ledger?limit=101`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(400);

    const empty = await request(app)
      .get(`/rep/retailers/${ids.retailerB}/ledger`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(empty.body.entries).toEqual([]);
    expect(empty.body.nextCursor).toBeNull();
  });
});
