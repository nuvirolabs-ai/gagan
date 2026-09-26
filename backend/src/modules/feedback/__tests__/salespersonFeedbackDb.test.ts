import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { SalespersonFeedbackService } from "../salespersonFeedbackService";

const tierId = randomUUID();
const repIds = [randomUUID(), randomUUID(), randomUUID()];
const staffIds = [randomUUID(), randomUUID()];
const retailerIds = [randomUUID(), randomUUID(), randomUUID()];
const service = new SalespersonFeedbackService(prisma);

beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.includes("feedback_slice_test")) {
    throw new Error("feedback_test_requires_isolated_local_database");
  }
  await prisma.tier.create({ data: { id: tierId, name: `Feedback ${tierId}` } });
  for (let i = 0; i < 3; i++) {
    await prisma.salesRep.create({ data: { id: repIds[i], name: `Feedback Rep ${i}`, phone: repIds[i] } });
    if (i < 2) await prisma.staffUser.create({ data: { id: staffIds[i], name: `Feedback Staff ${i}`, phone: staffIds[i], email: `${staffIds[i]}@example.test`, salesRepId: repIds[i] } });
    await prisma.retailer.create({ data: { id: retailerIds[i], name: `Feedback Store ${i}`, phone: retailerIds[i], shopAddress: "Local fixture", tierId, salesRepId: repIds[i] } });
  }
});

afterAll(async () => {
  await prisma.salespersonFeedback.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.retailer.deleteMany({ where: { id: { in: retailerIds } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: repIds } } });
  await prisma.tier.deleteMany({ where: { id: tierId } });
  await prisma.$disconnect();
});

describe("salesperson feedback on isolated local PostgreSQL", () => {
  it("persists actor and subject and scopes both readbacks after assignment changes", async () => {
    const input = { retailerId: retailerIds[0], expectedSalesRepId: repIds[0], description: "Helpful shop visit", clientReference: randomUUID() };
    const created = await service.submit(input);
    expect(created).toMatchObject({ retailerId: retailerIds[0], salesRepId: repIds[0] });
    await prisma.retailer.update({ where: { id: retailerIds[0] }, data: { salesRepId: repIds[1] } });
    expect((await service.submit(input)).id).toBe(created.id);
    expect((await service.forRetailer(retailerIds[0])).feedback.map((row: any) => row.id)).toContain(created.id);
    expect((await service.forRetailer(retailerIds[1])).feedback.map((row: any) => row.id)).not.toContain(created.id);
    await prisma.staffUser.update({ where: { id: staffIds[0] }, data: { status: "suspended" } });
    expect((await service.forAdmin([staffIds[0]])).feedback.map((row: any) => row.id)).toContain(created.id);
    expect((await service.forAdmin([staffIds[1]])).feedback.map((row: any) => row.id)).not.toContain(created.id);
    await expect(service.submit({ ...input, clientReference: randomUUID() })).rejects.toMatchObject({ code: "salesperson_assignment_changed" });
    const next = await service.submit({ ...input, expectedSalesRepId: repIds[1], description: "Later visit", clientReference: randomUUID() });
    expect(next.salesRepId).toBe(repIds[1]);
  });

  it("accepts a legacy assigned SalesRep without an active linked staff account", async () => {
    const created = await service.submit({ retailerId: retailerIds[2], expectedSalesRepId: repIds[2], description: "Helpful legacy rep", clientReference: randomUUID() });
    expect(created.salesRepId).toBe(repIds[2]);
    expect((await service.forRetailer(retailerIds[2])).feedback.map((row: any) => row.id)).toContain(created.id);
    expect((await service.forAdmin(null)).feedback.map((row: any) => row.id)).toContain(created.id);
    expect((await service.forAdmin([staffIds[0], staffIds[1]])).feedback.map((row: any) => row.id)).not.toContain(created.id);
  });

  it("pages past 100 rows without losing equal-timestamp feedback", async () => {
    const createdAt = new Date("2026-09-26T09:00:00.000Z");
    const prefix = randomUUID();
    await prisma.salespersonFeedback.createMany({ data: Array.from({ length: 105 }, (_, index) => ({
      retailerId: retailerIds[1], salesRepId: repIds[1], description: `Visit ${index}`, clientReference: `${prefix}-${index}`, createdAt,
    })) });
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const page = await service.forRetailer(retailerIds[1], cursor ?? undefined);
      page.feedback.forEach((row: any) => seen.add(row.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen.size).toBe(105);
    const adminSeen = new Set<string>();
    do {
      const page = await service.forAdmin([staffIds[1]], cursor ?? undefined);
      page.feedback.forEach((row: any) => adminSeen.add(row.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(adminSeen.size).toBeGreaterThanOrEqual(105);
    await expect(service.forRetailer(retailerIds[1], "bad")).rejects.toMatchObject({ code: "invalid_feedback_cursor" });
  });
});
