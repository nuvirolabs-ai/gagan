import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../lib/prisma";
import { RouteService } from "../routeService";

const tierId = randomUUID();
const repId = randomUUID();
const staffId = randomUUID();
const retailerId = randomUUID();
const service = new RouteService(prisma);

beforeAll(async () => {
  await prisma.tier.create({ data: { id: tierId, name: `route-race-${tierId}` } });
  await prisma.salesRep.create({ data: { id: repId, name: "Route race rep", phone: repId } });
  await prisma.staffUser.create({ data: { id: staffId, name: "Route race staff", phone: staffId, email: `${staffId}@example.test`, salesRepId: repId } });
  await prisma.retailer.create({ data: { id: retailerId, name: "Route race retailer", phone: retailerId, shopAddress: "Disposable test", tierId, salesRepId: repId } });
});

afterAll(async () => {
  await prisma.routePlanStop.deleteMany({ where: { routePlan: { salespersonId: staffId } } });
  await prisma.routePlan.deleteMany({ where: { salespersonId: staffId } });
  await prisma.auditEvent.deleteMany({ where: { actorStaffId: staffId, subjectType: "route_plan" } });
  await prisma.retailer.delete({ where: { id: retailerId } });
  await prisma.staffUser.delete({ where: { id: staffId } });
  await prisma.salesRep.delete({ where: { id: repId } });
  await prisma.tier.delete({ where: { id: tierId } });
  await prisma.$disconnect();
});

describe("route skip versus plan replacement on disposable PostgreSQL", () => {
  it("commits only one legal outcome and never loses a successful skip", async () => {
    for (let day = 1; day <= 4; day++) {
      const planDate = new Date(`2026-10-0${day}T00:00:00.000Z`);
      const plan = await prisma.routePlan.create({ data: { salespersonId: staffId, planDate, createdByStaffId: staffId, status: "draft" } });
      const stop = await prisma.routePlanStop.create({ data: { routePlanId: plan.id, retailerId, sequence: 1 } });
      const [skip, replace] = await Promise.allSettled([
        service.skipStop({ stopId: stop.id, salespersonId: staffId, reason: "Store closed" }),
        service.upsertPlan({ salespersonId: staffId, planDate, createdByStaffId: staffId, stops: [{ retailerId }] }),
      ]);
      expect([skip.status, replace.status].filter((status) => status === "fulfilled")).toHaveLength(1);
      const persisted = await prisma.routePlanStop.findMany({ where: { routePlanId: plan.id } });
      expect(persisted).toHaveLength(1);
      if (skip.status === "fulfilled") {
        expect(persisted[0]).toMatchObject({ id: stop.id, status: "skipped", skipReason: "Store closed" });
      } else {
        expect(persisted[0]).toMatchObject({ status: "pending" });
        expect(persisted[0].id).not.toBe(stop.id);
      }
    }
  });
});
