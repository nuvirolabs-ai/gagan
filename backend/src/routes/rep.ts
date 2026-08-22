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
