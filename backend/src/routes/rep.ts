import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRep, assignedRetailer, RepRequest } from "../lib/repAuth";
import { createOrderForRetailer } from "../lib/orders";
import { normalizeIndianPhone } from "../modules/identity/otpService";
import { lazyIdentityOtpService } from "../modules/identity/otpRuntime";
import { createOtpRouter } from "../modules/identity/otpRoutes";
import { createSessionRouter } from "../modules/identity/sessionRoutes";
import { lazyIdentitySessionService } from "../modules/identity/sessionRuntime";

const router = Router();

/* ---------------------------------- auth --------------------------------- */

async function findStaffRep(phoneInput: string) {
  const normalized = normalizeIndianPhone(phoneInput);
  return prisma.staffUser.findFirst({
    where: {
      phone: { in: [normalized, normalized.slice(3)] },
      status: "active",
      salesRepId: { not: null },
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
    findAccount: findStaffRep,
    issueIdentity: async (staff, req) => {
      if (!staff.salesRep) throw new Error("Staff account is not linked to a salesperson");
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

router.get("/me", requireRep, async (req: RepRequest, res) => {
  const rep = await prisma.salesRep.findUnique({
    where: { id: req.repId },
    select: { id: true, name: true, phone: true },
  });
  if (!rep) return res.status(401).json({ error: "Session no longer valid" });
  res.json({ rep });
});

/* -------------------------------- retailers ------------------------------- */

router.get("/retailers", requireRep, async (req: RepRequest, res) => {
  const retailers = await prisma.retailer.findMany({
    where: { salesRepId: req.repId },
    include: { tier: true },
    orderBy: { name: "asc" },
  });

  const summary = retailers.map((r) => {
    const limit = Number(r.creditLimit);
    const balance = Number(r.currentBalance);
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      shopAddress: r.shopAddress,
      tier: r.tier.name,
      creditLimit: limit,
      outstanding: balance,
      overdue: Number(r.overdueAmount),
      available: Math.max(limit - balance, 0),
      utilisationPct: limit > 0 ? Math.round((balance / limit) * 100) : 0,
    };
  });

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

  const [tier, orders, entries] = await Promise.all([
    prisma.tier.findUnique({ where: { id: retailer.tierId } }),
    prisma.order.findMany({
      where: { retailerId: retailer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: { include: { variant: { include: { product: true } } } } },
    }),
    prisma.ledgerEntry.findMany({
      where: { retailerId: retailer.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const limit = Number(retailer.creditLimit);
  const balance = Number(retailer.currentBalance);

  res.json({
    retailer: {
      id: retailer.id,
      name: retailer.name,
      phone: retailer.phone,
      shopAddress: retailer.shopAddress,
      tier: tier?.name ?? "—",
    },
    credit: {
      creditLimit: limit,
      outstanding: balance,
      overdue: Number(retailer.overdueAmount),
      available: Math.max(limit - balance, 0),
      utilisationPct: limit > 0 ? Math.round((balance / limit) * 100) : 0,
    },
    recentOrders: orders,
    recentLedger: entries,
  });
});

/** Catalog priced for the selected retailer's tier, not the rep's. */
router.get("/retailers/:id/catalog", requireRep, async (req: RepRequest, res) => {
  const retailer = await assignedRetailer(req.repId!, req.params.id);
  if (!retailer) return res.status(404).json({ error: "Retailer not found" });

  const [products, priceList, overrides] = await Promise.all([
    prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: "asc" } }),
    prisma.priceList.findMany({ where: { tierId: retailer.tierId } }),
    prisma.priceOverride.findMany({ where: { retailerId: retailer.id } }),
  ]);

  const tierPrice = new Map(priceList.map((p) => [p.variantId, Number(p.price)]));
  const overridePrice = new Map(overrides.map((o) => [o.variantId, Number(o.price)]));

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

router.post("/orders", requireRep, async (req: RepRequest, res) => {
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
    req.repId
  );
  if (!result.ok) return res.status(result.status).json(result.body);

  res.status(201).json({ order: result.order });
});

export default router;
