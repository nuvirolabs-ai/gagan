import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signRepToken, requireRep, assignedRetailer, RepRequest } from "../lib/repAuth";
import { createOrderForRetailer } from "../lib/orders";

const router = Router();
const MOCK_OTP = process.env.MOCK_OTP || "123456";

/* ---------------------------------- auth --------------------------------- */

router.post("/auth/otp/request", async (req, res) => {
  const parsed = z.object({ phone: z.string().min(10).max(15) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid phone" });

  const rep = await prisma.salesRep.findFirst({ where: { phone: parsed.data.phone } });
  if (!rep) return res.status(404).json({ error: "No sales rep registered with this phone" });

  console.log(`[mock rep OTP] ${parsed.data.phone} -> ${MOCK_OTP}`);
  res.json({ ok: true, message: "OTP sent (mocked)" });
});

router.post("/auth/otp/verify", async (req, res) => {
  const parsed = z
    .object({ phone: z.string().min(10).max(15), otp: z.string() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  if (parsed.data.otp !== MOCK_OTP) return res.status(401).json({ error: "Incorrect OTP" });

  const rep = await prisma.salesRep.findFirst({ where: { phone: parsed.data.phone } });
  if (!rep) return res.status(404).json({ error: "No sales rep registered with this phone" });

  res.json({
    token: signRepToken(rep.id),
    rep: { id: rep.id, name: rep.name, phone: rep.phone },
  });
});

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
