import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../lib/adminAuth";

const router = Router();
router.use(requireAdmin);

router.get("/products", async (_req, res) => {
  const [products, tiers, priceList] = await Promise.all([
    prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: "asc" } }),
    prisma.tier.findMany({ orderBy: { name: "asc" } }),
    prisma.priceList.findMany(),
  ]);

  const priceKey = (tierId: string, variantId: string) => `${tierId}:${variantId}`;
  const prices = new Map(priceList.map((p) => [priceKey(p.tierId, p.variantId), Number(p.price)]));

  res.json({
    tiers,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      variants: p.variants.map((v) => ({
        id: v.id,
        unitSize: v.unitSize,
        unit: v.unit,
        unitsPerCase: v.unitsPerCase,
        unitWeightKg: Number(v.unitWeightKg),
        prices: tiers.map((t) => ({
          tierId: t.id,
          tierName: t.name,
          price: prices.get(priceKey(t.id, v.id)) ?? null,
        })),
      })),
    })),
  });
});

const priceSchema = z.object({
  tierId: z.string(),
  variantId: z.string(),
  price: z.number().min(0),
});

router.post("/price-list", async (req, res) => {
  const parsed = priceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const variant = await prisma.variant.findUnique({ where: { id: parsed.data.variantId } });
  if (!variant) return res.status(404).json({ error: "Variant not found" });

  const row = await prisma.priceList.upsert({
    where: { tierId_variantId: { tierId: parsed.data.tierId, variantId: parsed.data.variantId } },
    update: { price: parsed.data.price },
    create: {
      tierId: parsed.data.tierId,
      variantId: parsed.data.variantId,
      productId: variant.productId,
      price: parsed.data.price,
    },
  });
  res.json({ price: row });
});

const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  variants: z
    .array(
      z.object({
        unitSize: z.string().min(1),
        unit: z.string().min(1),
        unitsPerCase: z.number().int().positive(),
        unitWeightKg: z.number().positive(),
      })
    )
    .min(1),
});

router.post("/products", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      variants: { create: parsed.data.variants },
    },
    include: { variants: true },
  });
  res.status(201).json({ product });
});

export default router;
