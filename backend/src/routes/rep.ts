import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { financialLedgerFor } from "../modules/finance/financialQueries";
import { financialSummaryFor } from "../modules/finance/financialSummary";
import { DEFAULT_WAREHOUSE_CODE, INVENTORY_STALE_AFTER_MS } from "../modules/inventory/inventoryService";
import { requireRep, assignedRetailer, RepRequest } from "../lib/repAuth";
import { createOrderForRetailer } from "../lib/orders";
import { createRateLimiter } from "../platform/http/rateLimit";
import { normalizeIndianPhone } from "../modules/identity/otpService";
import { lazyIdentityOtpService } from "../modules/identity/otpRuntime";
import { createOtpRouter } from "../modules/identity/otpRoutes";
import { createSessionRouter } from "../modules/identity/sessionRoutes";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";
import {
  createRequireSession,
  type IdentityAuthedRequest,
} from "../modules/identity/sessionAuth";
import { buildSalesHome, startOfUtcDay, startOfUtcWeek } from "../modules/sales/salesHome";

const router = Router();

/* ---------------------------------- auth --------------------------------- */

async function findStaffAccount(phoneInput: string) {
  const normalized = normalizeIndianPhone(phoneInput);
  return prisma.staffUser.findFirst({
    where: {
      phone: { in: [normalized, normalized.slice(3)] },
      status: "active",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      salesRep: { select: { id: true, name: true, phone: true } },
    },
  });
}

router.use(
  "/auth",
  createOtpRouter({
    realm: "staff",
    otpService: lazyIdentityOtpService,
    findAccount: findStaffAccount,
    issueIdentity: async (staff, req) => {
      const session = await lazyIdentitySessionService.createSession({
        realm: "staff",
        subjectId: staff.id,
        deviceName: req.header("x-device-name") ?? undefined,
        userAgent: req.header("user-agent") ?? undefined,
      });
      const claims = lazyIdentitySessionService.verifyAccessToken(session.accessToken, "staff");
      return {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        session: { id: session.session.id, expiresAt: session.session.expiresAt },
        staff: {
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          email: staff.email,
          permissions: claims.permissions,
        },
        rep: staff.salesRep,
      };
    },
  })
);

router.use(
  "/auth",
  createSessionRouter({
    realm: "staff",
    sessions: lazyIdentitySessionService,
    otpService: lazyIdentityOtpService,
    resolvePhone: async (staffId) => {
      const staff = await prisma.staffUser.findUniqueOrThrow({
        where: { id: staffId },
        select: { phone: true },
      });
      return staff.phone;
    },
  })
);

const requireStaffSession = createRequireSession("staff", lazyIdentitySessionService);

router.get("/me", requireStaffSession, async (req: IdentityAuthedRequest, res) => {
  const staff = await prisma.staffUser.findUnique({
    where: { id: req.identityAuth!.subjectId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      salesRep: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!staff) return res.status(401).json({ error: "Session no longer valid" });
  const { salesRep, ...identity } = staff;
  res.json({
    staff: { ...identity, permissions: req.staffAuth!.permissions },
    rep: salesRep,
  });
});

router.get("/home", requireStaffSession, async (req: IdentityAuthedRequest, res) => {
  const staff = await prisma.staffUser.findUnique({
    where: { id: req.identityAuth!.subjectId },
    select: {
      id: true,
      name: true,
      salesRepId: true,
      salesRep: { select: { id: true, name: true, territory: true } },
    },
  });
  if (!staff) return res.status(401).json({ error: "Session no longer valid" });

  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const weekStart = startOfUtcWeek(now);
  let retailers: Array<{ id: string; name: string; shopAddress: string; beatName: string | null; district: string | null }> = [];
  let visitsToday: Array<{ id: string; retailerId: string; checkedOutAt: Date | null; retailerName: string | null }> = [];
  let todaySales = 0;
  let weekSales = 0;
  let pendingApprovals = 0;

  if (staff.salesRepId) {
    const [assigned, visits, todayAgg, weekAgg, approvalCount] = await Promise.all([
      prisma.retailer.findMany({
        where: { salesRepId: staff.salesRepId },
        select: { id: true, name: true, shopAddress: true, district: true, beat: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.salesVisit.findMany({
        where: { salespersonId: staff.id, checkedInAt: { gte: dayStart } },
        select: { id: true, retailerId: true, checkedOutAt: true, retailer: { select: { name: true } } },
      }),
      prisma.order.aggregate({
        where: {
          retailer: { salesRepId: staff.salesRepId },
          createdAt: { gte: dayStart },
          status: { not: "rejected" },
        },
        _sum: { orderTotal: true },
      }),
      prisma.order.aggregate({
        where: {
          retailer: { salesRepId: staff.salesRepId },
          createdAt: { gte: weekStart },
          status: { not: "rejected" },
        },
        _sum: { orderTotal: true },
      }),
      prisma.approvalRequest.count({
        where: { status: "open", retailer: { salesRepId: staff.salesRepId } },
      }),
    ]);
    retailers = assigned.map((retailer) => ({
      id: retailer.id,
      name: retailer.name,
      shopAddress: retailer.shopAddress,
      beatName: retailer.beat?.name ?? null,
      district: retailer.district ?? null,
    }));
    visitsToday = visits.map((visit) => ({
      id: visit.id,
      retailerId: visit.retailerId,
      checkedOutAt: visit.checkedOutAt,
      retailerName: visit.retailer?.name ?? null,
    }));
    todaySales = Number(todayAgg._sum.orderTotal ?? 0);
    weekSales = Number(weekAgg._sum.orderTotal ?? 0);
    pendingApprovals = approvalCount;
  }

  res.json(
    buildSalesHome({
      staff: { id: staff.id, name: staff.name },
      territory: staff.salesRep?.territory ?? null,
      retailers,
      visitsToday,
      todaySales,
      weekSales,
      pendingApprovals,
      now,
    })
  );
});

router.get("/stock", requireStaffSession, async (_req, res) => {
  const [products, snapshots] = await Promise.all([
    prisma.product.findMany({ include: { variants: true }, orderBy: { name: "asc" } }),
    prisma.inventorySnapshot.findMany({ where: { warehouseCode: DEFAULT_WAREHOUSE_CODE } }),
  ]);
  const byMaterial = new Map(snapshots.map((snapshot) => [snapshot.sapMaterialId, snapshot]));
  const items = products.map((product) => {
    const snapshot = product.sapMaterialId ? byMaterial.get(product.sapMaterialId) : undefined;
    const stale = snapshot ? Date.now() - snapshot.syncedAt.getTime() > INVENTORY_STALE_AFTER_MS : false;
    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      sapMaterialId: product.sapMaterialId,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        unitSize: variant.unitSize,
        unitsPerCase: variant.unitsPerCase,
      })),
      availability: snapshot
        ? {
            available: Number(snapshot.available),
            warehouseCode: snapshot.warehouseCode,
            status: stale ? "stale" : snapshot.status,
            syncedAt: snapshot.syncedAt,
          }
        : { available: null, warehouseCode: DEFAULT_WAREHOUSE_CODE, status: "unknown", syncedAt: null },
    };
  });
  res.json({
    warehouseCode: DEFAULT_WAREHOUSE_CODE,
    stockTakeAvailable: false,
    items,
  });
});

/* -------------------------------- retailers ------------------------------- */

router.get("/retailers", requireRep, async (req: RepRequest, res) => {
  const retailers = await prisma.retailer.findMany({
    where: { salesRepId: req.repId },
    include: { tier: true },
    orderBy: { name: "asc" },
  });

  const summary = await Promise.all(retailers.map(async (r) => {
    const financial = (await financialSummaryFor(prisma, r.id))!;
    const limit = financial.creditLimit;
    const balance = financial.creditUsed;
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      shopAddress: r.shopAddress,
      tier: r.tier.name,
      creditLimit: limit,
      outstanding: balance,
      overdue: financial.overdue,
      available: financial.availableCredit,
      utilisationPct: limit > 0 ? Math.round((balance / limit) * 100) : 0,
      financialSummary: financial,
    };
  }));

  res.json({
    retailers: summary,
    totals: {
      count: summary.length,
      outstanding: summary.reduce((s, r) => s + r.outstanding, 0),
      overdue: summary.reduce((s, r) => s + r.overdue, 0),
    },
  });
});

router.get("/retailers/:id", requireRep, async (req: RepRequest, res) => {
  const retailer = await assignedRetailer(req.repId!, req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [tier, orders, entries, kycCase, creditProfile, financialSummary] = await Promise.all([
    prisma.tier.findUnique({ where: { id: retailer.tierId } }),
    prisma.order.findMany({
      where: { retailerId: retailer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: { include: { variant: { include: { product: true } } } } },
    }),
    financialLedgerFor(prisma, retailer.id).then((ledger) => ledger.slice(0, 5)),
    prisma.kycCase.findUnique({ where: { retailerId: retailer.id }, select: { id: true, status: true, submittedAt: true, reviewedAt: true, rejectionReason: true } }),
    prisma.creditProfile.findUnique({ where: { retailerId: retailer.id }, select: { kycVerifiedAt: true } }),
    financialSummaryFor(prisma, retailer.id),
  ]);

  const profile = await prisma.retailer.findUnique({
    where: { id: retailer.id },
    include: {
      group: { select: { id: true, name: true } },
      transporter: { select: { id: true, name: true } },
      beat: { select: { id: true, name: true } },
      buyerCategory: { select: { id: true, name: true } },
      buyerSubCategory: { select: { id: true, name: true } },
      salesRep: { select: { id: true, name: true } },
    },
  });

  const limit = financialSummary?.creditLimit ?? Number(retailer.creditLimit);
  const balance = financialSummary?.creditUsed ?? Number(retailer.currentBalance);

  res.json({
    retailer: {
      id: retailer.id,
      name: retailer.name,
      phone: retailer.phone,
      shopAddress: retailer.shopAddress,
      tier: tier?.name ?? "—",
      lifecycle: retailer.status,
      contactPerson: profile?.contactPerson ?? null,
      telephone: profile?.telephone ?? null,
      pin: profile?.pin ?? null,
      tehsil: profile?.tehsil ?? null,
      district: profile?.district ?? null,
      state: profile?.state ?? null,
      deliveryCity: profile?.deliveryCity ?? null,
      shopTenureYears: profile?.shopTenureYears ?? null,
      gstin: profile?.gstin ?? null,
      aadhaarNumber: profile?.aadhaarNumber ?? null,
      aadhaarPhotoAssetId: profile?.aadhaarPhotoAssetId ?? null,
      paymentTermDays: profile?.paymentTermDays ?? null,
      creditLimit: limit,
      grade: profile?.grade ?? null,
      upiId: profile?.upiId ?? null,
      group: profile?.group ?? null,
      groupId: profile?.groupId ?? null,
      transporter: profile?.transporter ?? null,
      transporterId: profile?.transporterId ?? null,
      beat: profile?.beat ?? null,
      beatId: profile?.beatId ?? null,
      buyerCategory: profile?.buyerCategory ?? null,
      buyerCategoryId: profile?.buyerCategoryId ?? null,
      buyerSubCategory: profile?.buyerSubCategory ?? null,
      buyerSubCategoryId: profile?.buyerSubCategoryId ?? null,
      salesmanRepId: profile?.salesRepId ?? null,
      salesman: profile?.salesRep ?? null,
    },
    kyc: { ...kycCase, legacyVerified: creditProfile?.kycVerifiedAt != null },
    credit: {
      creditLimit: limit,
      outstanding: balance,
      overdue: financialSummary?.overdue ?? Number(retailer.overdueAmount),
      available: financialSummary?.availableCredit ?? Math.max(limit - balance, 0),
      utilisationPct: limit > 0 ? Math.round((balance / limit) * 100) : 0,
    },
    financialSummary,
    recentOrders: orders,
    recentLedger: entries,
  });
});

/** Catalog priced for the selected retailer's tier, not the rep's. */
router.get("/retailers/:id/catalog", requireRep, async (req: RepRequest, res) => {
  const retailer = await assignedRetailer(req.repId!, req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [products, priceList, overrides, inventory] = await Promise.all([
    prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: "asc" } }),
    prisma.priceList.findMany({ where: { tierId: retailer.tierId } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id } }),
    prisma.inventorySnapshot.findMany({ where: { warehouseCode: DEFAULT_WAREHOUSE_CODE } }),
  ]);

  const tierPrice = new Map(priceList.map((p) => [p.variantId, Number(p.price)]));
  const overridePrice = new Map(overrides.map((o) => [o.variantId, Number(o.price)]));
  const inventoryByMaterial = new Map(inventory.map((snapshot) => [snapshot.sapMaterialId, snapshot]));

  const catalog = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    imageUrl: product.imageUrl,
    variants: product.variants.map((v) => {
      const override = overridePrice.get(v.id);
      const price = override ?? tierPrice.get(v.id) ?? null;
      const caseWeightKg = Number(v.unitWeightKg) * v.unitsPerCase;
      return {
        id: v.id,
        unitSize: v.unitSize,
        unit: v.unit,
        unitsPerCase: v.unitsPerCase,
        caseWeightKg,
        price,
        isOverride: override != null,
        pricePerKg:
          price != null && caseWeightKg > 0 ? Math.round((price / caseWeightKg) * 100) / 100 : null,
        availability: product.sapMaterialId && inventoryByMaterial.has(product.sapMaterialId)
          ? (() => {
              const snapshot = inventoryByMaterial.get(product.sapMaterialId)!;
              return {
                available: Number(snapshot.available),
                warehouseCode: snapshot.warehouseCode,
                status: Date.now() - snapshot.syncedAt.getTime() > INVENTORY_STALE_AFTER_MS ? "stale" : snapshot.status,
                syncedAt: snapshot.syncedAt,
              };
            })()
          : { available: null, warehouseCode: DEFAULT_WAREHOUSE_CODE, status: "unknown", syncedAt: null },
      };
    }),
  }));

  res.json({
    catalog,
    categories: [...new Set(products.map((p) => p.category))].sort(),
  });
});

/* --------------------------------- orders --------------------------------- */

const repOrderSchema = z.object({
  retailerId: z.string(),
  items: z.array(z.object({ variantId: z.string(), qty: z.number().int().positive() })).min(1),
});

router.post("/orders", requireRep, createRateLimiter({ name: "rep-order", limit: 20, windowMs: 60_000 }), async (req: RepRequest, res) => {
  const idempotencyKey = req.header("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 120) {
    return res.status(400).json({ error: "idempotency_key_required" });
  }
  const parsed = repOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const retailer = await assignedRetailer(req.repId!, parsed.data.retailerId);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const result = await createOrderForRetailer(
    retailer.id,
    parsed.data.items,
    "rep",
    req.repId,
    req.staffId,
    idempotencyKey
  );
  if (!result.ok) return res.status(result.status).json(result.body);

  res.status(201).json({
    order: result.order,
    creditDecision: result.decision,
    approvalRequest: result.approvalRequest ?? null,
    dispatchAuthorization: result.dispatchAuthorization ?? null,
  });
});

export default router;
