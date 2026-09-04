import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../../modules/identity/sessionRuntime";

const run = randomUUID();
const digits = run.replace(/\D/g, "").slice(0, 8).padEnd(8, "1");
const ids = {
  tier: randomUUID(),
  repA: randomUUID(),
  repB: randomUUID(),
  retailerA1: randomUUID(),
  retailerA2: randomUUID(),
  retailerB1: randomUUID(),
  staffA: randomUUID(),
  staffB: randomUUID(),
  manager: randomUUID(),
  product: randomUUID(),
  variant: randomUUID(),
};

let tokenA = "";
let tokenB = "";
const app = createApp();
const now = new Date();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

/** A real point in the past — baselines look back 180 days, not one month. */
function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** Inside the current period, for the metrics a monthly target counts. */
function thisMonth(hoursIn: number): Date {
  return new Date(Math.max(monthStart.getTime(), now.getTime() - hoursIn * 3_600_000));
}

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Perf tier ${run}` } });
  await prisma.salesRep.createMany({
    data: [
      { id: ids.repA, name: "Perf Rep A", phone: `71${digits}`, territory: `Perf-${run.slice(0, 6)}` },
      { id: ids.repB, name: "Perf Rep B", phone: `72${digits}`, territory: `Perf-${run.slice(0, 6)}` },
    ],
  });
  await prisma.retailer.createMany({
    data: [
      { id: ids.retailerA1, name: "Sharma Stores", phone: `73${digits}`, shopAddress: "12 Market Road, Pune", status: "active", tierId: ids.tier, salesRepId: ids.repA, overdueAmount: 42000 },
      { id: ids.retailerA2, name: "Verma Kirana", phone: `74${digits}`, shopAddress: "8 FC Road, Pune", status: "active", tierId: ids.tier, salesRepId: ids.repA },
      { id: ids.retailerB1, name: "Other Book Store", phone: `75${digits}`, shopAddress: "3 Baner Road, Pune", status: "active", tierId: ids.tier, salesRepId: ids.repB },
    ],
  });

  const salespersonRole = await prisma.role.findUniqueOrThrow({ where: { name: "salesperson" } });
  const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "field_manager" } });
  await prisma.staffUser.create({
    data: { id: ids.staffA, name: "Perf Staff A", phone: `76${digits}`, email: `perf-a-${run}@test.invalid`, salesRepId: ids.repA, roles: { create: { roleId: salespersonRole.id } } },
  });
  await prisma.staffUser.create({
    data: { id: ids.staffB, name: "Perf Staff B", phone: `77${digits}`, email: `perf-b-${run}@test.invalid`, salesRepId: ids.repB, roles: { create: { roleId: salespersonRole.id } } },
  });
  await prisma.staffUser.create({
    data: { id: ids.manager, name: "Perf Manager", phone: `78${digits}`, email: `perf-m-${run}@test.invalid`, roles: { create: { roleId: managerRole.id } } },
  });

  await prisma.product.create({
    data: {
      id: ids.product,
      name: `Perf Product ${run.slice(0, 6)}`,
      category: "Daal",
      variants: { create: { id: ids.variant, unitSize: "1 kg", unit: "kg", unitsPerCase: 30 } },
    },
  });

  // Sharma Stores keeps a steady 12-day cycle and is now well past it. These
  // sit in the 180-day baseline window but outside the current month, so they
  // shape the behavioural baseline without moving this month's target.
  for (const [index, offset] of [40, 28, 16].entries()) {
    await prisma.order.create({
      data: {
        retailerId: ids.retailerA1,
        placedBy: "rep",
        placedByRepId: ids.repA,
        orderTotal: 22400,
        status: "delivered",
        createdAt: daysAgo(offset),
        items: { create: { variantId: ids.variant, qtyOrdered: index + 1, unitPrice: 3150 } },
      },
    });
  }

  // Three orders inside the current period, which is what a monthly target counts.
  for (const [index, hoursIn] of [0, 1, 2].entries()) {
    await prisma.order.create({
      data: {
        retailerId: ids.retailerA2,
        placedBy: "rep",
        placedByRepId: ids.repA,
        orderTotal: 22400,
        status: "delivered",
        createdAt: thisMonth(hoursIn),
        items: { create: { variantId: ids.variant, qtyOrdered: index + 1, unitPrice: 3150 } },
      },
    });
  }

  const [sessionA, sessionB] = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staffA, deviceName: "test" }),
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staffB, deviceName: "test" }),
  ]);
  tokenA = sessionA.accessToken;
  tokenB = sessionB.accessToken;
});

afterAll(async () => {
  const staffIds = [ids.staffA, ids.staffB, ids.manager];
  const retailerIds = [ids.retailerA1, ids.retailerA2, ids.retailerB1];
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: staffIds } } });
  await prisma.achievementEvent.deleteMany({ where: { subjectId: { in: staffIds } } });
  await prisma.salesTarget.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.retailerProposal.deleteMany({ where: { submittedByStaffId: { in: staffIds } } });
  await prisma.orderItem.deleteMany({ where: { order: { retailerId: { in: retailerIds } } } });
  await prisma.order.deleteMany({ where: { retailerId: { in: retailerIds } } });
  await prisma.salesVisit.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  await prisma.retailerLocation.deleteMany({ where: { retailerId: { in: retailerIds } } });
  // A proposal approved in these tests creates a retailer; clear those too.
  await prisma.retailer.deleteMany({ where: { OR: [{ id: { in: retailerIds } }, { salesRepId: { in: [ids.repA, ids.repB] } }] } });
  await prisma.salesRep.deleteMany({ where: { id: { in: [ids.repA, ids.repB] } } });
  await prisma.variant.deleteMany({ where: { productId: ids.product } });
  await prisma.product.deleteMany({ where: { id: ids.product } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("targets derive from canonical records", () => {
  it("counts orders the salesperson actually placed", async () => {
    await prisma.salesTarget.create({
      data: {
        salespersonId: ids.staffA,
        metric: "order_value",
        periodStart: monthStart,
        periodEnd: monthEnd,
        targetValue: 120000,
      },
    });

    const response = await request(app)
      .get("/rep/performance/targets")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    const target = response.body.targets.find((entry: any) => entry.metric === "order_value");
    // Three seeded orders of ₹22,400.
    expect(target).toMatchObject({
      target: 120000,
      actual: 67200,
      remaining: 52800,
      completionPct: 56,
    });
    expect(target.sentence).toBe("₹52,800 more to go");
    expect(target.source).toContain("not counting rejected orders");
  });

  it("does not let a rejected order count towards a target", async () => {
    const rejected = await prisma.order.create({
      data: {
        retailerId: ids.retailerA2,
        placedBy: "rep",
        placedByRepId: ids.repA,
        orderTotal: 999999,
        status: "rejected",
        createdAt: thisMonth(0),
      },
    });
    const response = await request(app)
      .get("/rep/performance/targets")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(
      response.body.targets.find((entry: any) => entry.metric === "order_value").actual
    ).toBe(67200);
    await prisma.order.delete({ where: { id: rejected.id } });
  });

  it("reports no targets rather than inventing one", async () => {
    const response = await request(app)
      .get("/rep/performance/targets")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.body.targets).toEqual([]);
    expect(response.body.headline).toBeNull();
  });
});

describe("Today answers the whole screen in one request", () => {
  it("carries the day, the target, the standing and the actions together", async () => {
    const response = await request(app)
      .get("/rep/field/today")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("attendance");
    expect(response.body).toHaveProperty("route");
    expect(response.body).toHaveProperty("headlineTarget");
    expect(response.body).toHaveProperty("ranking");
    expect(response.body).toHaveProperty("achievements");
    expect(response.body).toHaveProperty("opportunities");
    expect(response.body.headlineTarget.sentence).toBe("₹52,800 more to go");
  });

  it("surfaces a missed order cycle with the measurements behind it", async () => {
    const response = await request(app)
      .get("/rep/field/today")
      .set("Authorization", `Bearer ${tokenA}`);

    const actions = response.body.opportunities.actions;
    const cycle = actions.find((action: any) =>
      ["ORDER_DUE", "HIGH_VALUE_RETAILER_MISSED"].includes(action.type)
    );
    expect(cycle).toBeDefined();
    expect(cycle.retailerName).toBe("Sharma Stores");
    expect(cycle.why).toMatch(/Usually orders every 12 days/);
    expect(cycle.recommendedAction.length).toBeGreaterThan(0);
    expect(cycle.measurements.length).toBeGreaterThan(0);
  });

  it("surfaces the overdue money finance already knows about", async () => {
    const response = await request(app)
      .get("/rep/field/today")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.body.opportunities.summary).toContainEqual(
      expect.objectContaining({ type: "COLLECTION_DUE", headline: "₹42,000 collections due" })
    );
  });

  it("never presents a statistic as a prediction", async () => {
    const response = await request(app)
      .get("/rep/field/today")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(JSON.stringify(response.body)).not.toMatch(/will order|we predict|guaranteed/i);
  });
});

describe("achievements fire once", () => {
  it("earns a milestone on the load that crosses it, and not again", async () => {
    await prisma.achievementEvent.deleteMany({ where: { subjectId: ids.staffA } });
    await prisma.salesTarget.updateMany({
      where: { salespersonId: ids.staffA, metric: "order_value" },
      data: { targetValue: 60000 },
    });

    const first = await request(app).get("/rep/field/today").set("Authorization", `Bearer ${tokenA}`);
    const earned = first.body.achievements.new;
    expect(earned.length).toBeGreaterThan(0);
    expect(earned.some((event: any) => event.type === "TARGET_EXCEEDED")).toBe(true);
    expect(earned.every((event: any) => event.reward === null)).toBe(true);

    const second = await request(app).get("/rep/field/today").set("Authorization", `Bearer ${tokenA}`);
    expect(second.body.achievements.new).toEqual([]);
    // Still remembered, just not celebrated twice.
    expect(second.body.achievements.recent.length).toBeGreaterThan(0);

    await prisma.salesTarget.updateMany({
      where: { salespersonId: ids.staffA, metric: "order_value" },
      data: { targetValue: 120000 },
    });
  });
});

describe("ranking is server-authoritative and scoped", () => {
  it("gives a salesperson their position inside their own territory", async () => {
    const response = await request(app)
      .get("/rep/performance/ranking")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(200);
    expect(response.body.scope).toBe("territory");
    expect(response.body.participants).toBeGreaterThanOrEqual(2);
    expect(response.body.rank).toBe(1);
    expect(response.body.metricReason.length).toBeGreaterThan(0);
  });

  it("ranks the salesperson with no orders below the one with orders", async () => {
    const response = await request(app)
      .get("/rep/performance/ranking")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.body.rank).toBeGreaterThan(1);
  });
});

describe("a salesperson sees only their own book", () => {
  it("finds opportunities only among their own retailers", async () => {
    const [mine, theirs] = await Promise.all([
      request(app).get("/rep/intelligence/opportunities").set("Authorization", `Bearer ${tokenA}`),
      request(app).get("/rep/intelligence/opportunities").set("Authorization", `Bearer ${tokenB}`),
    ]);
    const myNames = mine.body.triggers.map((trigger: any) => trigger.retailerName);
    expect(myNames).toContain("Sharma Stores");
    expect(theirs.body.triggers.map((t: any) => t.retailerName)).not.toContain("Sharma Stores");
  });

  it("refuses a baseline for another salesperson's store", async () => {
    const response = await request(app)
      .get(`/rep/intelligence/retailers/${ids.retailerB1}/baseline`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(404);
  });

  it("gives the baseline for a store on their own book", async () => {
    const response = await request(app)
      .get(`/rep/intelligence/retailers/${ids.retailerA1}/baseline`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(200);
    expect(response.body.baseline).toMatchObject({ orderCount: 3, medianIntervalDays: 12 });
  });

  it("cannot reach the sales leader's team view", async () => {
    const response = await request(app)
      .get("/admin/sales-leader")
      .set("Authorization", `Bearer ${tokenA}`);
    expect([401, 403]).toContain(response.status);
  });
});

describe("adding a store to the customer master", () => {
  let proposalId = "";

  it("lets a salesperson put a store forward", async () => {
    const response = await request(app)
      .post("/rep/retailer-proposals")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        businessName: "New Bharat Kirana",
        groupName: "Bharat Retail Group",
        ownerName: "Suresh",
        phone: `79${digits}`,
        transporter: "Pune Local Transport",
        shopAddress: "44 Market Road, Pune",
        deliveryCity: "Pune",
        shopDurationYears: 8,
        paymentTerms: "15 days",
        aadhaarNumber: "123456789012",
        aadhaarPhoto: {
          contentType: "image/png",
          bodyBase64: Buffer.from("test-aadhaar-photo").toString("base64"),
        },
        latitude: 18.5167,
        longitude: 73.8562,
        accuracyMeters: 12,
        proposedTierId: ids.tier,
      });
    expect(response.status).toBe(201);
    expect(response.body.proposal.status).toBe("pending");
    proposalId = response.body.proposal.id;
  });

  it("shows the salesperson the status of their own request", async () => {
    const response = await request(app)
      .get("/rep/retailer-proposals")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.body.proposals.map((p: any) => p.id)).toContain(proposalId);
  });

  it("hides it from another salesperson", async () => {
    const response = await request(app)
      .get("/rep/retailer-proposals")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.body.proposals.map((p: any) => p.id)).not.toContain(proposalId);
  });

  it("does not let the salesperson approve their own request", async () => {
    const response = await request(app)
      .post(`/admin/retailer-proposals/${proposalId}/approve`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({});
    expect([401, 403]).toContain(response.status);

    const still = await prisma.retailerProposal.findUniqueOrThrow({ where: { id: proposalId } });
    expect(still.status).toBe("pending");
  });

  it("refuses a duplicate of a store already on the master", async () => {
    const response = await request(app)
      .post("/rep/retailer-proposals")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        businessName: "Sharma Stores Again",
        groupName: "Sharma Retail Group",
        ownerName: "Ramesh",
        phone: `73${digits}`,
        transporter: "Pune Local Transport",
        shopAddress: "12 Market Road, Pune",
        deliveryCity: "Pune",
        shopDurationYears: 6,
        paymentTerms: "15 days",
        aadhaarNumber: "123456789012",
        aadhaarPhoto: {
          contentType: "image/png",
          bodyBase64: Buffer.from("duplicate-aadhaar-photo").toString("base64"),
        },
      });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("retailer_already_exists");
  });

  it("creates one canonical retailer when a reviewer approves", async () => {
    const { RetailerProposalService } = await import("../../customers/retailerProposalService");
    const result = await new RetailerProposalService(prisma).approve({
      proposalId,
      reviewerStaffId: ids.manager,
    });

    const retailer = await prisma.retailer.findUniqueOrThrow({ where: { id: result.retailer.id } });
    expect(retailer).toMatchObject({
      name: "New Bharat Kirana",
      salesRepId: ids.repA,
      // Approval admits the store; KYC still gates credit and dispatch.
      status: "pending_kyc",
    });
    expect(Number(retailer.creditLimit)).toBe(0);

    const location = await prisma.retailerLocation.findUniqueOrThrow({
      where: { retailerId: retailer.id },
    });
    expect(location.status).toBe("CAPTURED");

    const proposal = await prisma.retailerProposal.findUniqueOrThrow({ where: { id: proposalId } });
    expect(proposal).toMatchObject({ status: "approved", retailerId: retailer.id });
  });
});
