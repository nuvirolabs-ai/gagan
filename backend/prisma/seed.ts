import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recomputeOverdue } from "../src/lib/ageing";
import { upsertInventorySnapshot } from "../src/modules/inventory/inventoryService";
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
  // Recognition and customer-master proposals reference staff the same way, so
  // they go before the staff they point at.
  await prisma.achievementEvent.deleteMany();
  await prisma.retailerProposal.deleteMany();
  // Field-operations rows reference staff, retailers and visits with
  // onDelete: Restrict, so they are cleared before anything they point at.
  await prisma.locationPing.deleteMany();
  await prisma.customerActivity.deleteMany();
  await prisma.serviceIssue.deleteMany();
  await prisma.fieldTask.deleteMany();
  await prisma.fieldExpense.deleteMany();
  await prisma.salesTarget.deleteMany();
  await prisma.workdaySession.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.salesVisit.deleteMany();
  await prisma.routePlanStop.deleteMany();
  await prisma.routePlan.deleteMany();
  await prisma.retailerLocationHistory.deleteMany();
  await prisma.retailerLocation.deleteMany();
  await prisma.kycReview.deleteMany();
  await prisma.kycDocument.deleteMany();
  await prisma.kycCase.deleteMany();
  await prisma.evidenceAsset.deleteMany();
  await prisma.retailerContact.deleteMany();
  await prisma.retailerSapAccount.deleteMany();
  await prisma.approvalDispute.deleteMany();
  await prisma.approvalEscalation.deleteMany();
  await prisma.approvalDecision.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.creditDecisionComparison.deleteMany();
  await prisma.creditAssessment.deleteMany();
  await prisma.ratingProposal.deleteMany();
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
  await prisma.inventorySnapshot.deleteMany();
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

  // The calendar starts 60 days in the past so attendance history for days
  // already worked is graded against a real working-day calendar instead of
  // the "unknown days count as working" fallback.
  const CALENDAR_BACKFILL_DAYS = 60;
  const calendarStart = new Date();
  calendarStart.setUTCHours(0, 0, 0, 0);
  calendarStart.setUTCDate(calendarStart.getUTCDate() - CALENDAR_BACKFILL_DAYS);
  const workingDays = Array.from({ length: 550 + CALENDAR_BACKFILL_DAYS }, (_, offset) => {
    const date = new Date(calendarStart);
    date.setUTCDate(date.getUTCDate() + offset);
    const day = date.getUTCDay();
    return { date, isWorkingDay: day !== 0 && day !== 6 };
  });
  await prisma.workingCalendar.createMany({ data: workingDays });

  const rep = await prisma.salesRep.create({
    data: { name: "Ravi Kumar", phone: "9812345670", territory: "Pune North" },
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

  // A second salesperson in the same territory, so ranking has a scope with
  // more than one person in it and a leaderboard means something.
  const secondRep = await prisma.salesRep.create({
    data: { name: "Priya Deshmukh", phone: "9812345671", territory: rep.territory },
  });
  const secondSalesStaff = await prisma.staffUser.create({
    data: {
      name: secondRep.name,
      phone: secondRep.phone,
      email: "priya@gagan.test",
      employeeRef: "SALES-002",
      salesRepId: secondRep.id,
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
      { staffId: secondSalesStaff.id, roleId: roleIds.get("salesperson")! },
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

  // The public Gagan site shows these three consumer pack presentations and
  // supplies the imagery/copy. It does not publish a wholesale price list, so
  // these case prices are explicitly local-demo values until SAP pricing is synced.
  // The material IDs and quantities below are demo-only SAP-shaped values.
  // Real material/stock sync replaces these rows without changing either app.
  const catalog: [string, string, string, number, number, [number, number], string, string, string, number][] = [
    [
      "Gagan Toor Dal | 1 KG",
      "Daal",
      "1 kg",
      30,
      1,
      [3150, 3260],
      "/catalog-images/toor-dal-1kg.png",
      "100% pure and natural toor dal, finely processed and cleaned without oil or harsh chemicals. With 24 g protein per 100 g, it is a protein-rich staple for dal, sambar, khichdi and everyday Indian cooking.",
      "SAP-MAT-TOOR",
      420,
    ],
    [
      "Gagan Toor Dal | 5 KG",
      "Daal",
      "5 kg",
      6,
      5,
      [3150, 3260],
      "/catalog-images/toor-dal-5kg.png",
      "A larger household pack of Gagan Toor Dal with natural aroma and a clean, finely processed grain for frequent family cooking.",
      "SAP-MAT-TOOR",
      420,
    ],
    [
      "Gagan Toor Dal | 30 KG",
      "Daal",
      "30 kg",
      1,
      30,
      [3150, 3260],
      "/catalog-images/toor-dal-30kg.png",
      "The bulk pack for hotels, caterers, wholesalers and high-volume kitchens. Gagan Toor Dal is a rich source of protein, fibre and essential minerals.",
      "SAP-MAT-TOOR",
      420,
    ],
    ["Basmati Rice", "Rice", "1 kg", 12, 1, [5400, 5580], "/catalog-images/basmati-rice.png", "Long-grain rice for everyday retail and food-service orders.", "SAP-MAT-BASM", 180],
    ["Chana Dal", "Daal", "1 kg", 30, 1, [2850, 2950], "/catalog-images/chana-dal.png", "Split Bengal gram for dals, snacks and traditional Indian recipes.", "SAP-MAT-CHAN", 160],
    ["Sugar", "Sugar", "1 kg", 30, 1, [1650, 1720], "/catalog-images/sugar.png", "Everyday refined sugar for retail and food-service use.", "SAP-MAT-SUGR", 240],
    ["Moong Dal", "Daal", "1 kg", 30, 1, [3400, 3520], "/catalog-images/moong-dal.png", "Light, versatile split moong dal for quick-cooking meals.", "DEMO-MAT-MOON", 140],
    ["Sona Masoori Rice", "Rice", "1 kg", 25, 1, [2200, 2290], "/catalog-images/sona-masoori-rice.png", "Everyday rice with a light texture for home-style meals.", "DEMO-MAT-SONA", 200],
    ["Urad Dal", "Daal", "1 kg", 30, 1, [3600, 3730], "/catalog-images/urad-dal.png", "A staple pulse for idli, dosa, dal and savoury recipes.", "DEMO-MAT-URAD", 120],
    ["Poha", "Breakfast", "500 g", 40, 0.5, [1450, 1510], "/catalog-images/poha.png", "Flattened rice for breakfast, snacks and quick meal preparation.", "DEMO-MAT-POHA", 220],
  ];

  for (const [name, category, unitSize, unitsPerCase, unitWeightKg, [goldPrice, silverPrice], imageUrl, description, sapMaterialId] of catalog) {
    const product = await prisma.product.create({
      data: {
        name,
        category,
        imageUrl: imageUrl || null,
        description,
        sapMaterialId,
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

  // Demo stock mirrors the SAP connector shape so every seeded catalog item
  // can be previewed and ordered immediately. Keep these snapshots fresh for
  // a week; a successful SAP stock sync removes demo rows and writes the real
  // warehouse quantities in their place.
  const seededMaterials = new Set<string>();
  for (const [name, , , , , , , , sapMaterialId, onHand] of catalog) {
    // The three Toor Dal pack presentations share one SAP material and one
    // warehouse quantity, so create one material-level snapshot for them.
    if (seededMaterials.has(sapMaterialId)) continue;
    seededMaterials.add(sapMaterialId);
    const product = await prisma.product.findFirstOrThrow({ where: { name }, include: { variants: true } });
    await upsertInventorySnapshot(prisma, {
      productId: product.id,
      variantId: product.variants[0]?.id,
      sapMaterialId,
      warehouseCode: "WH-001",
      onHand,
      committed: 0,
      source: "demo-seed",
      syncedAt: daysFromNow(7),
    });
  }

  const retailer = await prisma.retailer.create({
    data: {
      name: "Mahesh Store",
      shopAddress: "12 Market Road, Pune",
      phone: "9999999999",
      status: "active",
      tierId: tierA.id,
      salesRepId: rep.id,
      creditLimit: 100000,
      // Balance and overdue are derived below from the seeded invoices, so the
      // demo data reconciles instead of being asserted.
      currentBalance: 0,
      overdueAmount: 0,
    },
  });
  await prisma.retailerLocation.create({
    data: { retailerId: retailer.id, status: "NOT_SET", source: "MIGRATION", locationVersion: 0 },
  });
  const kycCase = await prisma.kycCase.create({
    data: {
      retailerId: retailer.id,
      status: "approved",
      submittedAt: retailer.createdAt,
      reviewedAt: retailer.createdAt,
      reviewedByStaffId: platformAdmin.id,
    },
  });
  for (const type of ["business_registration", "identity_proof", "address_proof"] as const) {
    const asset = await prisma.evidenceAsset.create({
      data: {
        objectKey: `seed/kyc/${retailer.id}/${type}.pdf`,
        checksum: `seed-${type}-checksum`,
        contentType: "application/pdf",
        sizeBytes: 1,
        purpose: "kyc_document",
        createdByStaffId: salesStaff.id,
      },
    });
    await prisma.kycDocument.create({
      data: {
        caseId: kycCase.id,
        type,
        assetId: asset.id,
        status: "accepted",
        uploadedByStaffId: salesStaff.id,
      },
    });
  }
  await prisma.kycReview.create({
    data: {
      caseId: kycCase.id,
      reviewerStaffId: platformAdmin.id,
      decision: "approved",
      reason: "Seeded demo KYC verified for local testing.",
      createdAt: retailer.createdAt,
    },
  });
  await prisma.creditProfile.create({
    data: {
      retailerId: retailer.id,
      rating: "N",
      billingPattern: "unknown",
      accountCreatedAt: retailer.createdAt,
      kycVerifiedAt: new Date(),
      nextReviewAt: new Date(Date.UTC(2026, 9, 1)),
    },
  });

  // Additional assigned stores make the Sales app useful for a realistic
  // multi-store order-taking demo. They intentionally share the same rep and
  // are approved, active accounts so each one can be opened and ordered for.
  // Coordinates are the real Pune neighbourhoods each demo address names, so
  // the customer map, route distances and visit verification all behave the way
  // they will in the field instead of collapsing onto one point.
  const additionalDemoRetailers = [
    ["Shree Ganesh Grocers", "45 Laxmi Road, Pune", "9812345601", tierA.id, 75000, 18.5167, 73.8562],
    ["Annapurna Foods", "8 FC Road, Pune", "9812345602", tierA.id, 90000, 18.5236, 73.8408],
    ["Lakshmi Provision Mart", "22 Pimpri Market, Pimpri", "9812345603", tierB.id, 65000, 18.6279, 73.8009],
    ["Fresh Basket Wholesale", "14 Phase 1, Hinjewadi", "9812345604", tierA.id, 120000, 18.5913, 73.7389],
    ["Om Sai General Store", "6 Datta Mandir Road, Wakad", "9812345605", tierB.id, 55000, 18.5983, 73.7625],
    ["New Bharat Traders", "31 Paud Road, Kothrud", "9812345606", tierA.id, 100000, 18.5074, 73.8077],
    ["Radha Krishna Stores", "19 Baner Road, Baner", "9812345607", tierB.id, 80000, 18.5590, 73.7868],
    ["City Mart Foods", "5 Magarpatta Road, Hadapsar", "9812345608", tierA.id, 110000, 18.5089, 73.9260],
  ] as const;

  const demoRetailerIds: string[] = [];
  for (const [name, shopAddress, phone, tierId, creditLimit, latitude, longitude] of additionalDemoRetailers) {
    const demoRetailer = await prisma.retailer.create({
      data: {
        name,
        shopAddress,
        phone,
        status: "active",
        tierId,
        salesRepId: rep.id,
        creditLimit,
        currentBalance: 0,
        overdueAmount: 0,
      },
    });
    demoRetailerIds.push(demoRetailer.id);
    await prisma.retailerLocation.create({
      data: {
        retailerId: demoRetailer.id,
        latitude,
        longitude,
        accuracyMeters: 12,
        status: "VERIFIED",
        source: "MIGRATION",
        capturedAt: demoRetailer.createdAt,
        verifiedAt: demoRetailer.createdAt,
        locationVersion: 1,
      },
    });
    await prisma.kycCase.create({
      data: {
        retailerId: demoRetailer.id,
        status: "approved",
        submittedAt: demoRetailer.createdAt,
        reviewedAt: demoRetailer.createdAt,
        reviewedByStaffId: platformAdmin.id,
      },
    });
    await prisma.creditProfile.create({
      data: {
        retailerId: demoRetailer.id,
        rating: "N",
        billingPattern: "unknown",
        accountCreatedAt: demoRetailer.createdAt,
        kycVerifiedAt: demoRetailer.createdAt,
        nextReviewAt: new Date(Date.UTC(2026, 9, 1)),
      },
    });
  }

  // A published route for today, plus a couple of open tasks and a monthly
  // target, so the Sales app's Today screen has a real day to run rather than
  // an empty state. These are development fixtures only — nothing here is
  // created by production code paths.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.routePlan.create({
    data: {
      salespersonId: salesStaff.id,
      planDate: today,
      name: "Kothrud & Baner beat",
      status: "published",
      publishedAt: new Date(),
      createdByStaffId: platformAdmin.id,
      stops: {
        create: [retailer.id, ...demoRetailerIds.slice(0, 4)].map((retailerId, index) => ({
          retailerId,
          sequence: index + 1,
          purpose: index === 1 ? ("collection" as const) : ("sales_call" as const),
        })),
      },
    },
  });

  await prisma.fieldTask.createMany({
    data: [
      {
        assignedToStaffId: salesStaff.id,
        createdByStaffId: platformAdmin.id,
        retailerId: retailer.id,
        title: "Collect the signed delivery note",
        description: "Ask for the POD copy from the last dispatch before leaving the store.",
        priority: "high",
        dueAt: new Date(today.getTime() + 18 * 60 * 60 * 1000),
      },
      {
        assignedToStaffId: salesStaff.id,
        createdByStaffId: platformAdmin.id,
        title: "Photograph the new shelf display",
        priority: "normal",
      },
    ],
  });

  const periodStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
  await prisma.salesTarget.createMany({
    data: [
      // Every metric here has a canonical source: orders, order lines, visits,
      // productive visits and confirmed collections.
      { salespersonId: salesStaff.id, metric: "order_value", periodStart, periodEnd, targetValue: 400000, createdByStaffId: platformAdmin.id },
      { salespersonId: salesStaff.id, metric: "visits", periodStart, periodEnd, targetValue: 80, createdByStaffId: platformAdmin.id },
      { salespersonId: salesStaff.id, metric: "order_count", periodStart, periodEnd, targetValue: 24, createdByStaffId: platformAdmin.id },
      { salespersonId: salesStaff.id, metric: "line_items", periodStart, periodEnd, targetValue: 40, createdByStaffId: platformAdmin.id },
      { salespersonId: salesStaff.id, metric: "productive_outlets", periodStart, periodEnd, targetValue: 12, createdByStaffId: platformAdmin.id },
      { salespersonId: salesStaff.id, metric: "collection_value", periodStart, periodEnd, targetValue: 150000, createdByStaffId: platformAdmin.id },
      { salespersonId: secondSalesStaff.id, metric: "order_value", periodStart, periodEnd, targetValue: 400000, createdByStaffId: platformAdmin.id },
      { salespersonId: secondSalesStaff.id, metric: "visits", periodStart, periodEnd, targetValue: 80, createdByStaffId: platformAdmin.id },
    ],
  });

  // A store waiting for a manager's decision, so the approval queue is real.
  await prisma.retailerProposal.create({
    data: {
      businessName: "Sai Krupa Provision Store",
      ownerName: "Mahesh Jadhav",
      phone: "9812345690",
      shopAddress: "27 Sinhagad Road, Pune",
      latitude: 18.4655,
      longitude: 73.8271,
      accuracyMeters: 11,
      proposedTierId: tierB.id,
      notes: "Busy corner shop near the bus stand, buys weekly.",
      submittedByStaffId: salesStaff.id,
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
    where: { name: "Gagan Toor Dal | 1 KG" },
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

  // Behavioural history: several stores on their own steady order cycle, one
  // of them now well past it. This is what the intelligence engine reads to
  // say "usually orders every N days" — without it there is no baseline and,
  // correctly, no trigger.
  const cycleStores: Array<[string, number, number, number]> = [
    // [retailer name, cycle days, typical order value, days since last order]
    ["Shree Ganesh Grocers", 12, 22400, 19],
    ["Annapurna Foods", 14, 31000, 6],
    ["Lakshmi Provision Mart", 10, 16500, 21],
    ["New Bharat Traders", 21, 48000, 9],
  ];
  for (const [name, cycleDays, typicalValue, sinceLast] of cycleStores) {
    const store = await prisma.retailer.findFirst({ where: { name } });
    if (!store) continue;
    for (let index = 0; index < 6; index += 1) {
      const placedDaysAgo = sinceLast + index * cycleDays;
      // The most recent order for one store is deliberately a small one, so a
      // below-normal basket has something real to be measured against.
      const isSmallLastOrder = name === "Lakshmi Provision Mart" && index === 0;
      await prisma.order.create({
        data: {
          retailerId: store.id,
          status: "delivered",
          placedBy: "rep",
          placedByRepId: rep.id,
          orderTotal: isSmallLastOrder ? Math.round(typicalValue * 0.4) : typicalValue,
          createdAt: daysFromNow(-placedDaysAgo),
          items: {
            create: isSmallLastOrder
              ? [{ variantId: toorDal.variants[0].id, qtyOrdered: 2, unitPrice: 3150 }]
              : [
                  { variantId: toorDal.variants[0].id, qtyOrdered: 4, unitPrice: 3150 },
                  { variantId: basmati.variants[0].id, qtyOrdered: 3, unitPrice: 5400 },
                  { variantId: chana.variants[0].id, qtyOrdered: 2, unitPrice: 2850 },
                ],
          },
        },
      });
    }
  }

  // Orders placed today by the salesperson, so the current period has real
  // movement to show against the monthly targets rather than a period that has
  // only just begun.
  const todayOrders: Array<[string, number, number]> = [
    // [retailer name, order value, lines]
    ["Om Sai General Store", 84000, 3],
    ["Radha Krishna Stores", 61500, 2],
    ["City Mart Foods", 72400, 3],
    ["Fresh Basket Wholesale", 42600, 2],
  ];
  for (const [name, total, lines] of todayOrders) {
    const store = await prisma.retailer.findFirst({ where: { name } });
    if (!store) continue;
    const lineVariants = [toorDal.variants[0].id, basmati.variants[0].id, chana.variants[0].id];
    await prisma.order.create({
      data: {
        retailerId: store.id,
        status: "confirmed",
        placedBy: "rep",
        placedByRepId: rep.id,
        orderTotal: total,
        items: {
          create: lineVariants.slice(0, lines).map((variantId, index) => ({
            variantId,
            qtyOrdered: 3 + index,
            unitPrice: 3150,
          })),
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
