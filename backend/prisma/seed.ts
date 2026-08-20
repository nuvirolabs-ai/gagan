import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recomputeOverdue } from "../src/lib/ageing";
import { SOP_V4_POLICY, serializePolicy } from "../src/modules/credit/policy";
import { REASON_CATALOG } from "../src/modules/credit/reasonCodes";
import { ROLE_DEFINITIONS } from "../src/modules/identity/roleCatalog";

const prisma = new PrismaClient();

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function main() {
  // Wipe transactional data so the seed is repeatable.
  await prisma.dispatchAuthorization.deleteMany();
  await prisma.approvalDispute.deleteMany();
  await prisma.approvalEscalation.deleteMany();
  await prisma.approvalDecision.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.creditAssessment.deleteMany();
  await prisma.ratingHistory.deleteMany();
  await prisma.creditProfile.deleteMany();
  await prisma.creditPolicyVersion.deleteMany();
  await prisma.workingCalendar.deleteMany();
  await prisma.stepUpChallenge.deleteMany();
  await prisma.deviceSession.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.roleDelegation.deleteMany();
  await prisma.staffRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.staffUser.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.sapOutbox.deleteMany();
  await prisma.sapSyncState.deleteMany();
  await prisma.paymentReversalAllocation.deleteMany();
  await prisma.paymentReversal.deleteMany();
  await prisma.paymentAllocation.deleteMany();
  await prisma.paymentEvidence.deleteMany();
  await prisma.financialLedgerEntry.deleteMany();
  await prisma.creditNote.deleteMany();
  await prisma.reconciliationIssue.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.priceOverride.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.scheme.deleteMany();
  await prisma.retailer.deleteMany();
  await prisma.salesRep.deleteMany();
  await prisma.tier.deleteMany();

  const [tierA, tierB] = await Promise.all([
    prisma.tier.create({
      data: { name: "Gold", description: "High-volume retailers", paymentTermDays: 21 },
    }),
    prisma.tier.create({
      data: { name: "Silver", description: "Standard retailers", paymentTermDays: 15 },
    }),
  ]);

  const policy = await prisma.creditPolicyVersion.create({
    data: {
      version: SOP_V4_POLICY.version,
      name: SOP_V4_POLICY.name,
      active: true,
      rules: inputJson(serializePolicy(SOP_V4_POLICY)),
      reasonCatalog: inputJson(REASON_CATALOG),
      approvedAt: new Date(),
    },
  });

  const calendarStart = new Date();
  calendarStart.setUTCHours(0, 0, 0, 0);
  const workingDays = Array.from({ length: 550 }, (_, offset) => {
    const date = new Date(calendarStart);
    date.setUTCDate(date.getUTCDate() + offset);
    const day = date.getUTCDay();
    return { date, isWorkingDay: day !== 0 && day !== 6 };
  });
  await prisma.workingCalendar.createMany({ data: workingDays });

  const rep = await prisma.salesRep.create({
    data: { name: "Ravi Kumar", phone: "9812345670" },
  });

  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@gagan.test" },
    update: {},
    create: {
      email: "admin@gagan.test",
      name: "Ops Admin",
      passwordHash: await bcrypt.hash("admin123", 10),
    },
  });

  const permissionIds = new Map<string, string>();
  for (const permissionName of new Set(ROLE_DEFINITIONS.flatMap((role) => role.permissions))) {
    const permission = await prisma.permission.create({ data: { name: permissionName } });
    permissionIds.set(permissionName, permission.id);
  }

  const roleIds = new Map<string, string>();
  for (const definition of ROLE_DEFINITIONS) {
    const role = await prisma.role.create({
      data: {
        name: definition.name,
        description: definition.description,
        permissions: {
          create: definition.permissions.map((permissionName) => ({
            permissionId: permissionIds.get(permissionName)!,
          })),
        },
      },
    });
    roleIds.set(role.name, role.id);
  }

  const salesStaff = await prisma.staffUser.create({
    data: {
      name: rep.name,
      phone: rep.phone,
      email: "ravi@gagan.test",
      employeeRef: "SALES-001",
      salesRepId: rep.id,
    },
  });
  const platformAdmin = await prisma.staffUser.create({
    data: {
      name: admin.name,
      phone: "919999999998",
      email: admin.email,
      employeeRef: "ADMIN-001",
      adminUserId: admin.id,
    },
  });
  await prisma.staffRole.createMany({
    data: [
      { staffId: salesStaff.id, roleId: roleIds.get("salesperson")! },
      { staffId: platformAdmin.id, roleId: roleIds.get("platform_admin")! },
    ],
  });

  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      freeDeliveryThreshold: 10000,
      minOrderValue: 2500,
      supportPhone: "911234567890",
    },
  });

  // name, category, unitSize, unitsPerCase, unitWeightKg, [gold price, silver price]
  const catalog: [string, string, string, number, number, [number, number]][] = [
    ["Toor Dal", "Pulses", "1 kg", 30, 1, [3150, 3260]],
    ["Basmati Rice", "Rice", "1 kg", 12, 1, [5400, 5580]],
    ["Chana Dal", "Pulses", "1 kg", 30, 1, [2850, 2950]],
    ["Sugar", "Staples", "1 kg", 30, 1, [1650, 1720]],
    ["Moong Dal", "Pulses", "1 kg", 30, 1, [3400, 3520]],
    ["Sona Masoori Rice", "Rice", "1 kg", 25, 1, [2200, 2290]],
    ["Urad Dal", "Pulses", "1 kg", 30, 1, [3600, 3730]],
    ["Poha", "Staples", "500 g", 40, 0.5, [1450, 1510]],
  ];

  for (const [name, category, unitSize, unitsPerCase, unitWeightKg, [goldPrice, silverPrice]] of catalog) {
    const product = await prisma.product.create({
      data: {
        name,
        category,
        variants: { create: [{ unitSize, unit: "kg", unitsPerCase, unitWeightKg }] },
      },
      include: { variants: true },
    });
    const variant = product.variants[0];
    await prisma.priceList.createMany({
      data: [
        { tierId: tierA.id, productId: product.id, variantId: variant.id, price: goldPrice },
        { tierId: tierB.id, productId: product.id, variantId: variant.id, price: silverPrice },
      ],
    });
  }

  const retailer = await prisma.retailer.create({
    data: {
      name: "Mahesh Store",
      shopAddress: "12 Market Road, Pune",
      phone: "9999999999",
      tierId: tierA.id,
      salesRepId: rep.id,
      creditLimit: 100000,
      // Balance and overdue are derived below from the seeded invoices, so the
      // demo data reconciles instead of being asserted.
      currentBalance: 0,
      overdueAmount: 0,
    },
  });
  await prisma.creditProfile.create({
    data: {
      retailerId: retailer.id,
      rating: "N",
      billingPattern: "unknown",
      accountCreatedAt: retailer.createdAt,
      nextReviewAt: new Date(Date.UTC(2026, 9, 1)),
    },
  });

  // One featured scheme drives the banner; the rest feed the "8 Active Offers" count.
  await prisma.scheme.create({
    data: {
      name: "GOLD SCHEME",
      headline: "Buy ₹25,000 this week & get ₹500 discount",
      targetAmount: 25000,
      discountAmount: 500,
      featured: true,
      startsAt: daysFromNow(-3),
      endsAt: daysFromNow(4),
    },
  });
  for (let i = 1; i <= 7; i++) {
    await prisma.scheme.create({
      data: {
        name: `Combo Offer ${i}`,
        headline: `Bundle deal ${i} — save more on bulk cases`,
        targetAmount: 10000 + i * 2000,
        discountAmount: 200 + i * 50,
        startsAt: daysFromNow(-2),
        endsAt: daysFromNow(10),
      },
    });
  }

  // An in-flight order so Home shows a live delivery timeline.
  const toorDal = await prisma.product.findFirstOrThrow({
    where: { name: "Toor Dal" },
    include: { variants: true },
  });
  const basmati = await prisma.product.findFirstOrThrow({
    where: { name: "Basmati Rice" },
    include: { variants: true },
  });
  const expected = new Date();
  expected.setHours(18, 0, 0, 0);

  await prisma.order.create({
    data: {
      retailerId: retailer.id,
      status: "out_for_delivery",
      orderTotal: 42850,
      expectedDeliveryAt: expected,
      items: {
        create: [
          { variantId: toorDal.variants[0].id, qtyOrdered: 9, unitPrice: 3150 },
          { variantId: basmati.variants[0].id, qtyOrdered: 5, unitPrice: 5400 },
        ],
      },
    },
  });

  // Delivered history inside the scheme window, so the banner shows real progress.
  const chana = await prisma.product.findFirstOrThrow({
    where: { name: "Chana Dal" },
    include: { variants: true },
  });
  for (const [total, daysAgo] of [
    [8550, 2],
    [7750, 1],
  ] as const) {
    await prisma.order.create({
      data: {
        retailerId: retailer.id,
        status: "delivered",
        orderTotal: total,
        createdAt: daysFromNow(-daysAgo),
        items: {
          create: [{ variantId: chana.variants[0].id, qtyOrdered: 3, unitPrice: 2850 }],
        },
      },
    });
  }

  // Opening receivables with real due dates so ageing has something to bite on:
  // one comfortably overdue, one just past due, one still current.
  const openingInvoices: [number, number, number][] = [
    // [amount, raisedDaysAgo, termDays]
    [18500, 95, 21],
    [22000, 30, 21],
    [21912, 5, 21],
  ];
  let runningBalance = 0;
  for (const [amount, raisedDaysAgo, termDays] of openingInvoices) {
    runningBalance += amount;
    const raisedAt = daysFromNow(-raisedDaysAgo);
    await prisma.ledgerEntry.create({
      data: {
        retailerId: retailer.id,
        type: "invoice",
        amount,
        balanceAfter: runningBalance,
        createdAt: raisedAt,
        dueDate: daysFromNow(-raisedDaysAgo + termDays),
      },
    });
  }
  await prisma.retailer.update({
    where: { id: retailer.id },
    data: { currentBalance: runningBalance },
  });

  await prisma.notification.createMany({
    data: [
      { retailerId: retailer.id, title: "Order dispatched", body: "Your order is out for delivery." },
      { retailerId: retailer.id, title: "Payment due", body: "₹18,500 is overdue on your account." },
      { retailerId: retailer.id, title: "New scheme live", body: "Gold Scheme: buy ₹25,000, get ₹500 off." },
    ],
  });

  const overdue = await recomputeOverdue(prisma, retailer.id);
  console.log("Seed complete. Test retailer phone: 9999999999.");
  console.log(`Credit policy V${policy.version} active with ${workingDays.length} calendar days.`);
  console.log(`Opening balance Rs${runningBalance}, of which Rs${overdue} is overdue.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
