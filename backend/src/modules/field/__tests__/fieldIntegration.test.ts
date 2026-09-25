import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../lib/prisma";
import { lazyIdentitySessionService } from "../../../modules/identity/sessionRuntime";
import { startOfDay } from "../fieldDomain";

const run = randomUUID();
const digits = run.replace(/\D/g, "").slice(0, 8).padEnd(8, "1");
// Real UUIDs: the field API validates identifiers as UUIDs, exactly as the
// production `@default(uuid())` columns produce them.
const ids = {
  tier: randomUUID(),
  repA: randomUUID(),
  repB: randomUUID(),
  retailerA: randomUUID(),
  retailerB: randomUUID(),
  staffA: randomUUID(),
  staffB: randomUUID(),
  manager: randomUUID(),
  managerAdmin: randomUUID(),
  product: randomUUID(),
  variant: randomUUID(),
};

let tokenA = "";
let tokenB = "";
let managerToken = "";
const app = createApp();
const coordinates = { latitude: 18.52, longitude: 73.85, accuracyMeters: 12 };

beforeAll(async () => {
  await prisma.tier.create({ data: { id: ids.tier, name: `Field tier ${run}` } });
  await prisma.salesRep.createMany({
    data: [
      { id: ids.repA, name: "Field Rep A", phone: `81${digits}` },
      { id: ids.repB, name: "Field Rep B", phone: `82${digits}` },
    ],
  });
  await prisma.retailer.createMany({
    data: [
      {
        id: ids.retailerA,
        name: "Field Store A",
        phone: `83${digits}`,
        shopAddress: "A",
        tierId: ids.tier,
        salesRepId: ids.repA,
        creditLimit: 500_000,
      },
      {
        id: ids.retailerB,
        name: "Field Store B",
        phone: `84${digits}`,
        shopAddress: "B",
        tierId: ids.tier,
        salesRepId: ids.repB,
        creditLimit: 500_000,
      },
    ],
  });
  await prisma.creditProfile.create({
    data: {
      retailerId: ids.retailerA,
      rating: "N",
      billingPattern: "unknown",
      kycVerifiedAt: new Date(),
    },
  });
  await prisma.creditProfile.create({
    data: {
      retailerId: ids.retailerB,
      rating: "N",
      billingPattern: "unknown",
      kycVerifiedAt: new Date(),
    },
  });
  await prisma.product.create({
    data: {
      id: ids.product,
      name: `Visit flow product ${run}`,
      category: "test",
      sapMaterialId: `FIELD-${run}`,
    },
  });
  await prisma.variant.create({
    data: {
      id: ids.variant,
      productId: ids.product,
      unitSize: "1",
      unit: "case",
      unitsPerCase: 1,
      unitWeightKg: 1,
    },
  });
  await prisma.priceList.create({
    data: { tierId: ids.tier, productId: ids.product, variantId: ids.variant, price: 10_000 },
  });
  await prisma.inventorySnapshot.create({
    data: {
      productId: ids.product,
      variantId: ids.variant,
      sapMaterialId: `FIELD-${run}`,
      warehouseCode: "WH-001",
      onHand: 100,
      available: 100,
      syncedAt: new Date(),
      status: "available",
    },
  });
  const salespersonRole = await prisma.role.findUniqueOrThrow({ where: { name: "salesperson" } });
  const managerRole = await prisma.role.findUniqueOrThrow({ where: { name: "field_manager" } });
  await prisma.adminUser.create({
    data: {
      id: ids.managerAdmin,
      email: `field-m-${run}@test.invalid`,
      name: "Field Manager",
      passwordHash: "test-only",
    },
  });
  await prisma.staffUser.create({
    data: {
      id: ids.staffA,
      name: "Field Staff A",
      phone: `85${digits}`,
      email: `field-a-${run}@test.invalid`,
      salesRepId: ids.repA,
      roles: { create: { roleId: salespersonRole.id } },
    },
  });
  await prisma.staffUser.create({
    data: {
      id: ids.staffB,
      name: "Field Staff B",
      phone: `86${digits}`,
      email: `field-b-${run}@test.invalid`,
      salesRepId: ids.repB,
      roles: { create: { roleId: salespersonRole.id } },
    },
  });
  await prisma.staffUser.create({
    data: {
      id: ids.manager,
      name: "Field Manager",
      phone: `87${digits}`,
      email: `field-m-${run}@test.invalid`,
      adminUserId: ids.managerAdmin,
      roles: { create: { roleId: managerRole.id } },
    },
  });
  await prisma.staffUser.updateMany({
    where: { id: { in: [ids.staffA, ids.staffB] } },
    data: { managerId: ids.manager },
  });

  const [sessionA, sessionB, managerSession] = await Promise.all([
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staffA, deviceName: "test" }),
    lazyIdentitySessionService.createSession({ realm: "staff", subjectId: ids.staffB, deviceName: "test" }),
    lazyIdentitySessionService.createSession({ realm: "admin", subjectId: ids.manager, deviceName: "test" }),
  ]);
  tokenA = sessionA.accessToken;
  tokenB = sessionB.accessToken;
  managerToken = managerSession.accessToken;
});

afterAll(async () => {
  const staffIds = [ids.staffA, ids.staffB, ids.manager];
  const orders = await prisma.order.findMany({
    where: { retailerId: { in: [ids.retailerA, ids.retailerB] } },
    select: { id: true },
  });
  const orderIds = orders.map(({ id }) => id);
  await prisma.deviceSession.deleteMany({ where: { subjectId: { in: staffIds } } });
  await prisma.sapOutbox.deleteMany({ where: { referenceId: { in: orderIds } } });
  await prisma.commercialStatusEvent.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.dispatchAuthorization.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.approvalDecision.deleteMany({ where: { approvalRequest: { orderId: { in: orderIds } } } });
  await prisma.approvalEscalation.deleteMany({ where: { approvalRequest: { orderId: { in: orderIds } } } });
  await prisma.approvalDispute.deleteMany({ where: { approvalRequest: { orderId: { in: orderIds } } } });
  await prisma.approvalRequest.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.creditDecisionComparison.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.creditAssessment.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.creditProfile.deleteMany({ where: { retailerId: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.priceList.deleteMany({ where: { variantId: ids.variant } });
  await prisma.inventorySnapshot.deleteMany({ where: { productId: ids.product } });
  await prisma.variant.delete({ where: { id: ids.variant } });
  await prisma.product.delete({ where: { id: ids.product } });
  await prisma.locationPing.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.customerActivity.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.serviceIssue.deleteMany({ where: { raisedByStaffId: { in: staffIds } } });
  await prisma.fieldExpense.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.fieldTask.deleteMany({ where: { assignedToStaffId: { in: staffIds } } });
  await prisma.salesVisit.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.routePlanStop.deleteMany({
    where: { routePlan: { salespersonId: { in: staffIds } } },
  });
  await prisma.routePlan.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.leaveRequest.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.workdaySession.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.salesTarget.deleteMany({ where: { salespersonId: { in: staffIds } } });
  await prisma.staffUser.updateMany({ where: { id: { in: staffIds } }, data: { managerId: null } });
  await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  await prisma.adminUser.delete({ where: { id: ids.managerAdmin } });
  await prisma.retailerLocation.deleteMany({
    where: { retailerId: { in: [ids.retailerA, ids.retailerB] } },
  });
  await prisma.retailer.deleteMany({ where: { id: { in: [ids.retailerA, ids.retailerB] } } });
  await prisma.salesRep.deleteMany({ where: { id: { in: [ids.repA, ids.repB] } } });
  await prisma.tier.delete({ where: { id: ids.tier } });
  await prisma.$disconnect();
});

describe("the workday governs movement tracking", () => {
  it("refuses pings before the day is started", async () => {
    const response = await request(app)
      .post("/rep/field/tracking/pings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        pings: [
          {
            clientReference: `off-duty-${run}`,
            recordedAt: new Date().toISOString(),
            ...coordinates,
          },
        ],
      });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("workday_not_open");
    expect(await prisma.locationPing.count({ where: { salespersonId: ids.staffA } })).toBe(0);
  });

  it("tells the salesperson they are off duty before they clock in", async () => {
    const response = await request(app)
      .get("/rep/field/tracking/state")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.body).toMatchObject({ tracking: false, reason: "off_duty" });
    expect(response.body.message).toBeTruthy();
  });

  it("accepts pings once the day is open, and only once each", async () => {
    await request(app)
      .post("/rep/field/attendance/start")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(coordinates)
      .expect(201);

    const state = await request(app)
      .get("/rep/field/tracking/state")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(state.body).toMatchObject({ tracking: true, reason: "tracking_active" });

    const batch = {
      pings: [
        {
          clientReference: `on-duty-${run}`,
          recordedAt: new Date().toISOString(),
          ...coordinates,
        },
      ],
    };
    const first = await request(app)
      .post("/rep/field/tracking/pings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(batch);
    expect(first.body).toMatchObject({ accepted: 1, duplicates: 0 });

    const replay = await request(app)
      .post("/rep/field/tracking/pings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(batch);
    expect(replay.body).toMatchObject({ accepted: 0, duplicates: 1 });
    expect(await prisma.locationPing.count({ where: { salespersonId: ids.staffA } })).toBe(1);
  });

  it("refuses a second open day and then closes the first", async () => {
    await request(app)
      .post("/rep/field/attendance/start")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(coordinates)
      .expect(409);

    const end = await request(app)
      .post("/rep/field/attendance/end")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(coordinates);
    expect(end.status).toBe(200);
    expect(end.body.session.status).toBe("closed");
    expect(end.body.session.workedMinutes).toBeGreaterThanOrEqual(0);
  });

  it("stops tracking again the moment the day is closed", async () => {
    const response = await request(app)
      .post("/rep/field/tracking/pings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        pings: [
          {
            clientReference: `after-hours-${run}`,
            recordedAt: new Date().toISOString(),
            ...coordinates,
          },
        ],
      });
    expect(response.status).toBe(409);
    expect(await prisma.locationPing.count({ where: { salespersonId: ids.staffA } })).toBe(1);
  });
});

describe("field data stays inside the salesperson's own assignment", () => {
  it("refuses activity against another salesperson's store", async () => {
    const response = await request(app)
      .post("/rep/field/activities")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ retailerId: ids.retailerB, type: "stock_check" });
    expect(response.status).toBe(404);
    expect(await prisma.customerActivity.count({ where: { retailerId: ids.retailerB } })).toBe(0);
  });

  it("refuses a service issue against another salesperson's store", async () => {
    const response = await request(app)
      .post("/rep/field/issues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ retailerId: ids.retailerB, type: "damaged_product", description: "Crushed cartons" });
    expect(response.status).toBe(404);
  });

  it("shows each salesperson only their own customer map", async () => {
    const [mapA, mapB] = await Promise.all([
      request(app).get("/rep/field/customers/map").set("Authorization", `Bearer ${tokenA}`),
      request(app).get("/rep/field/customers/map").set("Authorization", `Bearer ${tokenB}`),
    ]);
    expect(mapA.body.customers.map((c: any) => c.id)).toContain(ids.retailerA);
    expect(mapA.body.customers.map((c: any) => c.id)).not.toContain(ids.retailerB);
    expect(mapB.body.customers.map((c: any) => c.id)).toContain(ids.retailerB);
  });

  it("refuses the back-office field routes to a salesperson token", async () => {
    for (const path of [
      "/admin/field/attendance",
      "/admin/field/leave",
      "/admin/field/routes",
      "/admin/field/expenses",
      "/admin/field/issues",
    ]) {
      const response = await request(app).get(path).set("Authorization", `Bearer ${tokenA}`);
      // A staff (rep-realm) token is not an admin session at all.
      expect([401, 403]).toContain(response.status);
    }
  });
});

describe("customer activity and issues reach the customer timeline", () => {
  it("records a structured activity once, even when the offline write is replayed", async () => {
    const body = {
      retailerId: ids.retailerA,
      type: "competitor_observation",
      notes: "Rival ran a 10% board",
      clientReference: `activity-${run}`,
    };
    const first = await request(app)
      .post("/rep/field/activities")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(body);
    expect(first.status).toBe(201);

    const replay = await request(app)
      .post("/rep/field/activities")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotent).toBe(true);
    expect(replay.body.activity.id).toBe(first.body.activity.id);

    expect(
      await prisma.customerActivity.count({
        where: { retailerId: ids.retailerA, type: "competitor_observation" },
      })
    ).toBe(1);
  });

  it("raising an issue also writes the matching activity", async () => {
    const response = await request(app)
      .post("/rep/field/issues")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        retailerId: ids.retailerA,
        type: "delivery_issue",
        description: "Short by two cases",
        priority: "high",
      });
    expect(response.status).toBe(201);

    const activities = await prisma.customerActivity.findMany({
      where: { retailerId: ids.retailerA, type: "complaint_raised" },
    });
    expect(activities).toHaveLength(1);
    expect(activities[0].serviceIssueId).toBe(response.body.issue.id);
  });
});

describe("a planned stop and the visit that happened stay one record", () => {
  it("links the route stop on check-in and settles it only on checkout", async () => {
    const planDate = startOfDay(new Date());
    const plan = await prisma.routePlan.create({
      data: {
        salespersonId: ids.staffA,
        planDate,
        status: "published",
        publishedAt: new Date(),
        stops: { create: [{ retailerId: ids.retailerA, sequence: 1, purpose: "collection" }] },
      },
      include: { stops: true },
    });

    const before = await request(app)
      .get("/rep/field/route")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(before.body.route.progress).toMatchObject({ total: 1, pending: 1, completionPct: 0 });
    expect(before.body.route.nextStop.id).toBe(plan.stops[0].id);

    const checkIn = await request(app)
      .post(`/rep/retailers/${ids.retailerA}/check-in`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send(coordinates);
    expect(checkIn.status).toBe(201);
    expect(checkIn.body.visit.routeStopId).toBe(plan.stops[0].id);
    // The visit inherits the purpose the stop was planned for.
    expect(checkIn.body.visit.purpose).toBe("collection");

    const retry = await request(app)
      .post(`/rep/retailers/${ids.retailerA}/check-in`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send(coordinates);
    expect(retry.status).toBe(201);
    expect(retry.body.visit.id).toBe(checkIn.body.visit.id);
    expect(await prisma.salesVisit.count({ where: { salespersonId: ids.staffA, checkedOutAt: null } })).toBe(1);

    const recovered = await request(app)
      .get("/rep/visits")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(recovered.body.visits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: checkIn.body.visit.id,
        retailerId: ids.retailerA,
        checkedOutAt: null,
      }),
    ]));

    const order = await request(app)
      .post("/rep/orders")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", `visit-order-${run}`)
      .send({ retailerId: ids.retailerA, items: [{ variantId: ids.variant, qty: 1 }] });
    expect(order.status).toBe(201);
    const orderReadback = await request(app)
      .get(`/rep/orders/${order.body.order.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(orderReadback.status).toBe(200);
    expect(orderReadback.body.order.id).toBe(order.body.order.id);
    expect(orderReadback.body.order).toMatchObject({
      source: "SALESPERSON_APP",
      creatorName: "Field Staff A",
      retailer: { id: ids.retailerA, name: "Field Store A" },
      createdAt: expect.any(String),
    });
    const commercialCodes = orderReadback.body.commercialStatus.timeline.map((event: { code: string }) => event.code);
    expect(commercialCodes).toContain("SALES_ORDER_PUNCHED");
    if (order.body.dispatchAuthorization) {
      expect(commercialCodes.filter((code: string) => code === "SALES_ORDER_CREATED")).toHaveLength(1);
      expect(orderReadback.body.commercialStatus.currentCode).toBe("SALES_ORDER_CREATED");
    } else {
      expect(commercialCodes).toContain("SALES_ORDER_APPROVAL_SENT");
      expect(commercialCodes).not.toContain("SALES_ORDER_CREATED");
      expect(orderReadback.body.commercialStatus.currentCode).toBe("SALES_ORDER_APPROVAL_SENT");
    }

    const visitAfterOrder = await prisma.salesVisit.findUniqueOrThrow({ where: { id: checkIn.body.visit.id } });
    expect(visitAfterOrder.checkedOutAt).toBeNull();
    const recoveredAfterOrder = await request(app)
      .get("/rep/visits")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(recoveredAfterOrder.body.visits).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: checkIn.body.visit.id, checkedOutAt: null }),
    ]));

    const after = await request(app).get("/rep/field/route").set("Authorization", `Bearer ${tokenA}`);
    expect(after.body.route.progress).toMatchObject({ visited: 0, pending: 1, completionPct: 0 });
    expect(after.body.route.nextStop.id).toBe(plan.stops[0].id);
    expect(await prisma.salesVisit.count({ where: { retailerId: ids.retailerA } })).toBe(1);

    const checkOut = await request(app)
      .post(`/rep/visits/${checkIn.body.visit.id}/check-out`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ ...coordinates, outcome: "payment_collected", notes: "Collected part payment" });
    expect(checkOut.status).toBe(200);
    expect(checkOut.body.visit.outcome).toBe("payment_collected");
    const closedReadback = await request(app)
      .get("/rep/visits")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(closedReadback.body.visits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: checkIn.body.visit.id,
        checkedOutAt: expect.any(String),
      }),
    ]));
    const completed = await request(app).get("/rep/field/route").set("Authorization", `Bearer ${tokenA}`);
    expect(completed.body.route.progress).toMatchObject({ visited: 1, pending: 0, completionPct: 100 });
    expect(completed.body.route.nextStop).toBeNull();
  });

  it("refuses to skip a stop that belongs to another salesperson", async () => {
    const stop = await prisma.routePlanStop.findFirstOrThrow({
      where: { routePlan: { salespersonId: ids.staffA } },
    });
    const response = await request(app)
      .post(`/rep/field/route/stops/${stop.id}/skip`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ reason: "Not my beat" });
    expect(response.status).toBe(404);
  });
});

describe("today reads real work, not placeholders", () => {
  it("reports the day's own visits, activities and receivables", async () => {
    const response = await request(app)
      .get("/rep/field/today")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body.todayMetrics.visits).toBe(1);
    expect(response.body.todayMetrics.productiveVisits).toBe(1);
    expect(response.body.todayMetrics.customersCovered).toBe(1);
    expect(response.body.route.progress.completionPct).toBe(100);
    expect(response.body.attendance.mark).toBe("present");
    // No target row exists for this salesperson, so no target is reported.
    expect(response.body.targets).toEqual([]);
    expect(response.body.pendingCollections.retailers).toEqual([]);
  });

  it("reports target versus achievement once a target exists", async () => {
    const now = new Date();
    await prisma.salesTarget.create({
      data: {
        salespersonId: ids.staffA,
        metric: "visits",
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
        targetValue: 4,
      },
    });

    const response = await request(app)
      .get("/rep/field/today")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.body.targets).toHaveLength(1);
    expect(response.body.targets[0]).toMatchObject({
      metric: "visits",
      target: 4,
      actual: 1,
      remaining: 3,
      completionPct: 25,
      // The salesperson reads a sentence, not a pair of numbers.
      sentence: "3 more visits",
      source: "Store check-ins you recorded this period.",
    });
    // Today leads with a single target rather than a list.
    expect(response.body.headlineTarget).toMatchObject({ metric: "visits", remaining: 3 });
  });

  it("projects the activity timeline from canonical rows", async () => {
    const response = await request(app)
      .get("/rep/field/activity-feed")
      .set("Authorization", `Bearer ${tokenA}`);
    const kinds = response.body.entries.map((entry: any) => entry.kind);
    expect(kinds).toContain("workday_started");
    expect(kinds).toContain("workday_ended");
    expect(kinds).toContain("visit");
    expect(kinds).toContain("activity");
    expect(kinds).toContain("service_issue");
  });
});

describe("a salesperson without a planned beat can still sell", () => {
  it("lists an assigned retailer, loads its catalogue, and places an order with no route", async () => {
    const routeBefore = await request(app)
      .get("/rep/field/route")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(routeBefore.body.route).toBeNull();
    expect(
      await prisma.routePlan.count({
        where: { salespersonId: ids.staffB, planDate: startOfDay(new Date()) },
      })
    ).toBe(0);

    const retailerList = await request(app)
      .get("/rep/retailers")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(retailerList.body.retailers).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.retailerB, name: "Field Store B" })])
    );

    const catalog = await request(app)
      .get(`/rep/retailers/${ids.retailerB}/catalog`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(catalog.body.catalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.product,
          variants: expect.arrayContaining([expect.objectContaining({ id: ids.variant })]),
        }),
      ])
    );

    const order = await request(app)
      .post("/rep/orders")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("Idempotency-Key", `no-beat-order-${run}`)
      .send({ retailerId: ids.retailerB, items: [{ variantId: ids.variant, qty: 1 }] })
      .expect(201);
    const orderReadback = await request(app)
      .get(`/rep/orders/${order.body.order.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(orderReadback.body.order).toMatchObject({
      id: order.body.order.id,
      retailer: { id: ids.retailerB, name: "Field Store B" },
      source: "SALESPERSON_APP",
    });

    const routeAfter = await request(app)
      .get("/rep/field/route")
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(200);
    expect(routeAfter.body.route).toBeNull();
    expect(
      await prisma.routePlan.count({
        where: { salespersonId: ids.staffB, planDate: startOfDay(new Date()) },
      })
    ).toBe(0);
  });
});

describe("daily team sales summary uses canonical orders", () => {
  it("reconciles date-bounded order totals across multiple assigned salespeople", async () => {
    const from = "2026-09-20T00:00:00.000Z";
    const to = "2026-09-20T23:59:59.999Z";
    await prisma.order.createMany({
      data: [
        {
          retailerId: ids.retailerA,
          placedBy: "rep",
          placedByRepId: ids.repA,
          orderTotal: "1250.50",
          createdAt: new Date("2026-09-20T09:00:00.000Z"),
        },
        {
          retailerId: ids.retailerB,
          placedBy: "rep",
          placedByRepId: ids.repB,
          orderTotal: "2750.25",
          createdAt: new Date("2026-09-20T11:00:00.000Z"),
        },
        {
          retailerId: ids.retailerB,
          placedBy: "rep",
          placedByRepId: ids.repB,
          orderTotal: "1499.75",
          createdAt: new Date("2026-09-20T15:00:00.000Z"),
        },
        {
          retailerId: ids.retailerA,
          placedBy: "rep",
          placedByRepId: ids.repA,
          orderTotal: "9000.00",
          createdAt: new Date("2026-09-21T00:00:00.000Z"),
        },
      ],
    });

    const response = await request(app)
      .get("/admin/field/team")
      .query({ from, to })
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);

    const metricsByStaff = new Map(
      response.body.members.map((member: any) => [member.salespersonId, member.metrics])
    );
    expect([...metricsByStaff.keys()].sort()).toEqual([ids.staffA, ids.staffB].sort());
    expect(metricsByStaff.get(ids.staffA)).toMatchObject({ orders: 1, orderValue: 1250.5 });
    expect(metricsByStaff.get(ids.staffB)).toMatchObject({ orders: 2, orderValue: 4250 });
    expect(
      [...metricsByStaff.values()].reduce((sum: number, metrics: any) => sum + metrics.orderValue, 0)
    ).toBe(5500.5);
  });
});

describe("leave is decided by someone else", () => {
  it("keeps a salesperson out of their own approval", async () => {
    const created = await request(app)
      .post("/rep/field/leave")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        fromDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        toDate: new Date(Date.now() + 6 * 86_400_000).toISOString(),
        type: "casual",
        reason: "Family function",
      });
    expect(created.status).toBe(201);

    const overlapping = await request(app)
      .post("/rep/field/leave")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        fromDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        toDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        type: "casual",
        reason: "Same days again",
      });
    expect(overlapping.status).toBe(409);

    // A salesperson session cannot reach the deciding route at all.
    const decide = await request(app)
      .post(`/admin/field/leave/${created.body.request.id}/decision`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ decision: "approved" });
    expect([401, 403]).toContain(decide.status);

    const stillPending = await prisma.leaveRequest.findUniqueOrThrow({
      where: { id: created.body.request.id },
    });
    expect(stillPending.status).toBe("pending");
  });
});
