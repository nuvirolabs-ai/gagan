/**
 * Salesperson visual UAT fixture.
 *
 * This is deliberately a staging-only fixture for the final visual review of
 * the Sales app. It creates one isolated salesperson, five assigned retailers,
 * a published route, an open workday, canonical visits/orders, and one real
 * overdue invoice so the running app can show its active-day state. It never
 * changes Ravi's data and it refuses to run unless NODE_ENV is exactly
 * `staging`.
 *
 *   NODE_ENV=staging npm run seed:sales-visual-uat
 *   NODE_ENV=staging npm run seed:sales-visual-uat -- --date=2026-09-04
 *
 * The script is add-only for its own namespace. Re-running it does not reset
 * route-stop progress, close an active day, duplicate orders, or pre-record a
 * milestone. The normal Today read model records the first 75% achievement on
 * first load, which is what makes the real milestone sheet appear once.
 */
import { PrismaClient } from "@prisma/client";
import { recomputeOverdue } from "../src/lib/ageing";

const prisma = new PrismaClient();

const FIXTURE = {
  salesperson: {
    name: "Nikhil Patil",
    phone: "9812367800",
    email: "sales-visual-uat@gagan.test",
    employeeRef: "SALES-VISUAL-UAT",
    territory: "Pune Central · visual UAT",
  },
  retailers: [
    ["Sharma General Store", "18 MG Road, Shivajinagar, Pune", "9812367801", 18.5308, 73.8475],
    ["Kaveri Super Mart", "7 Commercial Street, Camp, Pune", "9812367802", 18.5196, 73.8553],
    ["Patel Mart", "24 Karve Road, Kothrud, Pune", "9812367803", 18.5074, 73.8077],
    ["Sahyadri Grocers", "11 Prabhat Road, Deccan, Pune", "9812367804", 18.5148, 73.8382],
    ["Bharat Provisions", "32 Bhandarkar Road, Pune", "9812367805", 18.5231, 73.8371],
  ] as const,
  routeTimes: ["09:30", "11:00", "12:30", "14:00", "15:30"],
  orderTotals: [100000, 95000, 105000] as const,
  targetValue: 400000,
  overdueAmount: 40500,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseDate(argv: string[], now = new Date()): Date {
  const flag = argv.find((argument) => argument.startsWith("--date="));
  if (flag === undefined) return utcDay(now);
  const raw = flag.slice("--date=".length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`--date must be YYYY-MM-DD, got "${raw}"`);
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new Error(`--date must be a real calendar date, got "${raw}"`);
  }
  return parsed;
}

function shifted(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function changed(message: string, changes: string[]) {
  changes.push(message);
}

async function ensureRetailer(input: {
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  tierId: string;
  salesRepId: string;
  actorId: string;
}) {
  const existing = await prisma.retailer.findUnique({ where: { phone: input.phone } });
  if (existing && existing.salesRepId && existing.salesRepId !== input.salesRepId) {
    throw new Error(`fixture phone ${input.phone} already belongs to another salesperson`);
  }

  const retailer = existing
    ? await prisma.retailer.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          shopAddress: input.address,
          status: "active",
          tierId: input.tierId,
          salesRepId: input.salesRepId,
          creditLimit: 100000,
        },
      })
    : await prisma.retailer.create({
        data: {
          name: input.name,
          shopAddress: input.address,
          phone: input.phone,
          status: "active",
          tierId: input.tierId,
          salesRepId: input.salesRepId,
          creditLimit: 100000,
          currentBalance: 0,
          overdueAmount: 0,
        },
      });

  await prisma.retailerLocation.upsert({
    where: { retailerId: retailer.id },
    update: {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: 12,
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
    create: {
      retailerId: retailer.id,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyMeters: 12,
      status: "VERIFIED",
      source: "MIGRATION",
      capturedAt: new Date(),
      verifiedAt: new Date(),
      locationVersion: 1,
    },
  });

  await prisma.kycCase.upsert({
    where: { retailerId: retailer.id },
    update: { status: "approved", reviewedAt: new Date(), reviewedByStaffId: input.actorId },
    create: {
      retailerId: retailer.id,
      status: "approved",
      submittedAt: retailer.createdAt,
      reviewedAt: new Date(),
      reviewedByStaffId: input.actorId,
    },
  });

  await prisma.creditProfile.upsert({
    where: { retailerId: retailer.id },
    update: { rating: "A", kycVerifiedAt: new Date(), kycVerifiedByStaffId: input.actorId },
    create: {
      retailerId: retailer.id,
      rating: "A",
      billingPattern: "regular",
      accountCreatedAt: retailer.createdAt,
      kycVerifiedAt: new Date(),
      kycVerifiedByStaffId: input.actorId,
    },
  });

  return retailer;
}

async function ensureOrder(input: {
  idempotencyKey: string;
  retailerId: string;
  salesRepId: string;
  orderTotal: number;
  status: "confirmed" | "delivered";
  createdAt: Date;
  variants: Array<{ id: string; price: number }>;
}) {
  const existing = await prisma.order.findFirst({
    where: { retailerId: input.retailerId, idempotencyKey: input.idempotencyKey },
    select: { id: true, orderNo: true },
  });
  if (existing) return existing;

  const items = input.variants.slice(0, 3).map((variant, index) => ({
    variantId: variant.id,
    qtyOrdered: index === 0 ? 12 : index === 1 ? 7 : 4,
    unitPrice: variant.price,
  }));
  return prisma.order.create({
    data: {
      retailerId: input.retailerId,
      idempotencyKey: input.idempotencyKey,
      placedBy: "rep",
      placedByRepId: input.salesRepId,
      status: input.status,
      orderTotal: input.orderTotal,
      createdAt: input.createdAt,
      items: { create: items },
    },
    select: { id: true, orderNo: true },
  });
}

async function ensureVisit(input: {
  staffId: string;
  retailerId: string;
  routeStopId: string;
  latitude: number;
  longitude: number;
  checkedInAt: Date;
  notes: string;
  outcome: "order_placed" | "no_order";
}) {
  const existing = await prisma.salesVisit.findFirst({
    where: { salespersonId: input.staffId, routeStopId: input.routeStopId },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.salesVisit.create({
    data: {
      salespersonId: input.staffId,
      retailerId: input.retailerId,
      routeStopId: input.routeStopId,
      checkInLatitude: input.latitude,
      checkInLongitude: input.longitude,
      checkInAccuracyMeters: 12,
      storeLatitudeSnapshot: input.latitude,
      storeLongitudeSnapshot: input.longitude,
      distanceFromStoreMeters: 0,
      verificationStatus: "VERIFIED",
      checkedInAt: input.checkedInAt,
      checkedOutLatitude: input.latitude,
      checkedOutLongitude: input.longitude,
      checkedOutAccuracyMeters: 12,
      checkedOutAt: shifted(input.checkedInAt, 24 * 60 * 1000),
      checkoutDistanceMeters: 0,
      devicePlatform: "android-visual-uat",
      purpose: "sales_call",
      outcome: input.outcome,
      notes: input.notes,
    },
    select: { id: true },
  });
}

async function ensureActivity(input: {
  staffId: string;
  retailerId: string;
  visitId: string;
  orderId?: string;
  reference: string;
  type: "order_placed" | "no_order";
  occurredAt: Date;
  notes: string;
}) {
  const existing = await prisma.customerActivity.findFirst({
    where: { salespersonId: input.staffId, clientReference: input.reference },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.customerActivity.create({
    data: {
      salespersonId: input.staffId,
      retailerId: input.retailerId,
      visitId: input.visitId,
      orderId: input.orderId,
      clientReference: input.reference,
      type: input.type,
      occurredAt: input.occurredAt,
      notes: input.notes,
    },
    select: { id: true },
  });
}

async function main() {
  if (process.env.NODE_ENV !== "staging") {
    throw new Error(`refusing to run with NODE_ENV=${process.env.NODE_ENV || "(unset)"}; this fixture is staging-only`);
  }

  const now = new Date();
  const workDate = parseDate(process.argv, now);
  const dateLabel = workDate.toISOString().slice(0, 10);
  const monthStart = new Date(Date.UTC(workDate.getUTCFullYear(), workDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(workDate.getUTCFullYear(), workDate.getUTCMonth() + 1, 0));
  const changes: string[] = [];

  const actor = await prisma.staffUser.findFirst({
    where: { roles: { some: { role: { name: "platform_admin" } } } },
    select: { id: true, name: true },
  });
  if (!actor) throw new Error("no platform_admin found to attribute visual UAT fixture writes to");

  const salespersonRole = await prisma.role.findUnique({ where: { name: "salesperson" }, select: { id: true } });
  if (!salespersonRole) throw new Error("salesperson role is missing; run the normal staging seed first");

  const existingRep = await prisma.salesRep.findFirst({ where: { phone: FIXTURE.salesperson.phone } });
  const salesRep = existingRep
    ? existingRep
    : await prisma.salesRep.create({
        data: {
          name: FIXTURE.salesperson.name,
          phone: FIXTURE.salesperson.phone,
          territory: FIXTURE.salesperson.territory,
        },
      });
  if (existingRep && existingRep.name !== FIXTURE.salesperson.name) {
    throw new Error(`fixture phone ${FIXTURE.salesperson.phone} already belongs to ${existingRep.name}`);
  }

  const existingStaff = await prisma.staffUser.findFirst({
    where: { OR: [{ email: FIXTURE.salesperson.email }, { phone: FIXTURE.salesperson.phone }] },
    select: { id: true, name: true, phone: true, email: true, status: true, salesRepId: true },
  });
  if (existingStaff && existingStaff.salesRepId && existingStaff.salesRepId !== salesRep.id) {
    throw new Error(`fixture identity ${FIXTURE.salesperson.phone} is linked to another SalesRep`);
  }
  if (existingStaff && (existingStaff.phone !== FIXTURE.salesperson.phone || existingStaff.email !== FIXTURE.salesperson.email)) {
    throw new Error(`fixture identity ${FIXTURE.salesperson.phone} or ${FIXTURE.salesperson.email} already belongs to another staff record`);
  }
  const staff = existingStaff
    ? await prisma.staffUser.update({
        where: { id: existingStaff.id },
        data: { name: FIXTURE.salesperson.name, email: FIXTURE.salesperson.email, status: "active", salesRepId: salesRep.id },
      })
    : await prisma.staffUser.create({
        data: {
          name: FIXTURE.salesperson.name,
          phone: FIXTURE.salesperson.phone,
          email: FIXTURE.salesperson.email,
          employeeRef: FIXTURE.salesperson.employeeRef,
          status: "active",
          salesRepId: salesRep.id,
        },
      });
  await prisma.staffRole.upsert({
    where: { staffId_roleId: { staffId: staff.id, roleId: salespersonRole.id } },
    update: {},
    create: { staffId: staff.id, roleId: salespersonRole.id },
  });
  changed(`staging-only salesperson ready: ${staff.name} (${staff.phone})`, changes);

  const tier = await prisma.tier.findFirst({ where: { name: "Gold" }, select: { id: true } });
  if (!tier) throw new Error("Gold tier is missing; run the normal staging seed first");

  const retailers = [] as Array<Awaited<ReturnType<typeof ensureRetailer>>>;
  for (const [name, address, phone, latitude, longitude] of FIXTURE.retailers) {
    retailers.push(
      await ensureRetailer({
        name,
        address,
        phone,
        latitude,
        longitude,
        tierId: tier.id,
        salesRepId: salesRep.id,
        actorId: actor.id,
      })
    );
  }
  changed(`${retailers.length} assigned retailers ready with verified coordinates`, changes);

  const plan = await prisma.routePlan.upsert({
    where: { salespersonId_planDate: { salespersonId: staff.id, planDate: workDate } },
    update: { name: "Pune Central visual route" },
    create: {
      salespersonId: staff.id,
      planDate: workDate,
      name: "Pune Central visual route",
      status: "published",
      publishedAt: new Date(),
      createdByStaffId: actor.id,
    },
  });
  const stops = [] as Array<{ id: string; retailerId: string; sequence: number }>;
  for (let index = 0; index < retailers.length; index += 1) {
    const retailer = retailers[index];
    const stop = await prisma.routePlanStop.upsert({
      where: { routePlanId_retailerId: { routePlanId: plan.id, retailerId: retailer.id } },
      update: {
        sequence: index + 1,
        note: `${FIXTURE.routeTimes[index]} · sales call`,
        purpose: "sales_call",
      },
      create: {
        routePlanId: plan.id,
        retailerId: retailer.id,
        sequence: index + 1,
        purpose: "sales_call",
        note: `${FIXTURE.routeTimes[index]} · sales call`,
      },
      select: { id: true, retailerId: true, sequence: true },
    });
    stops.push(stop);
  }
  changed(`published route ready for ${dateLabel}: ${stops.length} stops`, changes);

  const startedAt = new Date(Math.max(workDate.getTime() + 5 * 60 * 1000, now.getTime() - 38 * 60 * 1000));
  const session = await prisma.workdaySession.findUnique({
    where: { salespersonId_workDate: { salespersonId: staff.id, workDate } },
    select: { id: true, status: true },
  });
  if (!session) {
    await prisma.workdaySession.create({
      data: {
        salespersonId: staff.id,
        workDate,
        status: "open",
        startedAt,
        startLatitude: FIXTURE.retailers[0][3],
        startLongitude: FIXTURE.retailers[0][4],
        startAccuracyMeters: 12,
        devicePlatform: "android-visual-uat",
      },
    });
    changed("open workday created", changes);
  } else if (session.status === "open") {
    changed("open workday preserved", changes);
  } else {
    changed(`existing workday preserved (${session.status}); use a new --date for a fresh visual run`, changes);
  }

  const variants = await prisma.variant.findMany({
    where: { priceList: { some: { tierId: tier.id } } },
    include: { priceList: { where: { tierId: tier.id }, select: { price: true } } },
    orderBy: { product: { name: "asc" } },
    take: 3,
  });
  if (variants.length === 0) throw new Error("no Gold-tier catalogue variants found; run the normal staging seed first");
  const pricedVariants = variants.map((variant) => ({ id: variant.id, price: Number(variant.priceList[0]?.price ?? 0) }));
  if (pricedVariants.some((variant) => variant.price <= 0)) throw new Error("visual UAT variants have no usable Gold price");

  const currentOrders = [] as Array<{ id: string; orderNo: number }>;
  for (let index = 0; index < FIXTURE.orderTotals.length; index += 1) {
    const order = await ensureOrder({
      idempotencyKey: `sales-visual-uat-${dateLabel}-${index + 1}`,
      retailerId: retailers[index].id,
      salesRepId: salesRep.id,
      orderTotal: FIXTURE.orderTotals[index],
      status: "confirmed",
      createdAt: new Date(Math.max(workDate.getTime() + 10 * 60 * 1000, now.getTime() - (18 - index * 6) * 60 * 1000)),
      variants: pricedVariants,
    });
    currentOrders.push(order);
  }
  const previousOrderDate = shifted(monthStart, -5 * DAY_MS);
  const previousOrder = await ensureOrder({
    idempotencyKey: `sales-visual-uat-previous-${dateLabel}`,
    retailerId: retailers[3].id,
    salesRepId: salesRep.id,
    orderTotal: 42000,
    status: "delivered",
    createdAt: previousOrderDate,
    variants: pricedVariants,
  });
  changed(`canonical rep orders ready: ${currentOrders.map((order) => `GGN-${String(order.orderNo).padStart(8, "0")}`).join(", ")} plus previous-order context`, changes);

  for (let index = 0; index < 2; index += 1) {
    const retailer = retailers[index];
    const stop = stops[index];
    const checkedInAt = new Date(Math.max(workDate.getTime() + (index + 1) * 30 * 60 * 1000, now.getTime() - (90 - index * 35) * 60 * 1000));
    const visit = await ensureVisit({
      staffId: staff.id,
      retailerId: retailer.id,
      routeStopId: stop.id,
      latitude: Number(FIXTURE.retailers[index][3]),
      longitude: Number(FIXTURE.retailers[index][4]),
      checkedInAt,
      notes: index === 0 ? "Order confirmed during visual UAT visit." : "Reviewed shelf availability; follow-up planned.",
      outcome: index === 0 ? "order_placed" : "no_order",
    });
    await prisma.routePlanStop.update({ where: { id: stop.id }, data: { status: "visited", visitedAt: checkedInAt } });
    await ensureActivity({
      staffId: staff.id,
      retailerId: retailer.id,
      visitId: visit.id,
      orderId: index === 0 ? currentOrders[0].id : undefined,
      reference: `sales-visual-uat-visit-${dateLabel}-${index + 1}`,
      type: index === 0 ? "order_placed" : "no_order",
      occurredAt: checkedInAt,
      notes: index === 0 ? "Placed the opening visual UAT order." : "No order today; revisit after shelf review.",
    });
  }
  changed("two completed visits and three remaining route stops ready", changes);

  const overdueRetailer = retailers[0];
  const dueDate = shifted(workDate, -7 * DAY_MS);
  const existingInvoice = await prisma.ledgerEntry.findFirst({
    where: { retailerId: overdueRetailer.id, type: "invoice", amount: FIXTURE.overdueAmount, dueDate },
    select: { id: true },
  });
  if (!existingInvoice) {
    const balanceAfter = Number(overdueRetailer.currentBalance) + FIXTURE.overdueAmount;
    await prisma.ledgerEntry.create({
      data: {
        retailerId: overdueRetailer.id,
        type: "invoice",
        amount: FIXTURE.overdueAmount,
        balanceAfter,
        dueDate,
        createdAt: shifted(workDate, -14 * DAY_MS),
      },
    });
    await prisma.retailer.update({ where: { id: overdueRetailer.id }, data: { currentBalance: balanceAfter } });
    changed(`${overdueRetailer.name} has one real overdue invoice for ${FIXTURE.overdueAmount}`, changes);
  }
  await recomputeOverdue(prisma, overdueRetailer.id, now);

  const target = await prisma.salesTarget.upsert({
    where: {
      salespersonId_metric_periodStart_periodEnd: {
        salespersonId: staff.id,
        metric: "order_value",
        periodStart: monthStart,
        periodEnd: monthEnd,
      },
    },
    update: { targetValue: FIXTURE.targetValue },
    create: {
      salespersonId: staff.id,
      metric: "order_value",
      periodStart: monthStart,
      periodEnd: monthEnd,
      targetValue: FIXTURE.targetValue,
      createdByStaffId: actor.id,
    },
    select: { targetValue: true },
  });
  changed(`monthly order-value target ready: ${Number(target.targetValue)}; current seeded rep orders total ${FIXTURE.orderTotals.reduce((sum, value) => sum + value, 0)}`, changes);

  console.log("Salesperson visual UAT fixture (staging only)");
  console.log(`  Login phone       ${staff.phone}`);
  console.log("  Mock OTP          123456");
  console.log(`  Work date         ${dateLabel}`);
  console.log(`  Salesperson       ${staff.name}`);
  console.log(`  Route             ${retailers.map((retailer) => retailer.name).join(" → ")}`);
  console.log("  Active state      open day · 2 visited · 3 pending · next stop Patel Mart");
  console.log("  Sales target      ₹400,000 with ₹300,000 current-period rep orders (75%)");
  console.log(`  Attention         ${overdueRetailer.name} · ₹${FIXTURE.overdueAmount.toLocaleString("en-IN")} overdue`);
  console.log("  Milestone         not pre-recorded; first Today load should earn TARGET_75");
  console.log("\nChanges:");
  console.log(changes.map((message) => `  + ${message}`).join("\n"));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`\nVISUAL UAT FIXTURE FAILED: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
