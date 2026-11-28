import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createSchemesRouter() {
  const router = Router();

  // GET /admin/promotions/schemes
  router.get("/promotions/schemes", async (_req, res) => {
    try {
      const [schemes, tiers, variants, categoryRows] = await Promise.all([
        prisma.scheme.findMany({
          orderBy: [{ active: "desc" }, { createdAt: "desc" }],
        }),
        prisma.tier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
        prisma.variant.findMany({
          where: { catalogStatus: "active", product: { catalogStatus: "active" } },
          select: {
            id: true,
            unitSize: true,
            unitsPerCase: true,
            unitWeightKg: true,
            product: { select: { name: true, category: true } },
          },
          orderBy: [{ product: { name: "asc" } }, { unitWeightKg: "asc" }],
        }),
        prisma.product.findMany({
          where: { catalogStatus: "active" },
          select: { category: true },
          distinct: ["category"],
        }),
      ]);

      const tierMap = new Map(tiers.map((t) => [t.id, t.name]));
      const varMap = new Map(variants.map((v) => [v.id, `${v.product.name} (${v.unitSize} × ${v.unitsPerCase})`]));

      const now = new Date();
      const enriched = schemes.map((s) => ({
        id: s.id,
        name: s.name,
        headline: s.headline,
        description: s.description,
        targetAmount: Number(s.targetAmount),
        discountAmount: Number(s.discountAmount),
        ruleType: s.ruleType,
        minQuantity: s.minQuantity,
        qualifyingVariantId: s.qualifyingVariantId,
        qualifyingVariantName: s.qualifyingVariantId ? varMap.get(s.qualifyingVariantId) || null : null,
        qualifyingCategory: s.qualifyingCategory,
        qualifyingWeightKg: s.qualifyingWeightKg ? Number(s.qualifyingWeightKg) : null,
        rewardType: s.rewardType,
        rewardValue: s.rewardValue ? Number(s.rewardValue) : null,
        freeVariantId: s.freeVariantId,
        freeVariantName: s.freeVariantId ? varMap.get(s.freeVariantId) || null : null,
        freePackagingUnits: s.freePackagingUnits,
        targetAudience: s.targetAudience,
        targetTierId: s.targetTierId,
        targetTierName: s.targetTierId ? tierMap.get(s.targetTierId) || null : null,
        targetTerritory: s.targetTerritory,
        featured: s.featured,
        active: s.active,
        isLiveNow: Boolean(s.active && s.startsAt <= now && s.endsAt >= now),
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        createdAt: s.createdAt,
      }));

      const stats = {
        totalSchemes: enriched.length,
        activeSchemes: enriched.filter((s) => s.active).length,
        featuredSchemes: enriched.filter((s) => s.featured).length,
      };

      res.json({
        stats,
        schemes: enriched,
        tiers,
        variants,
        categories: categoryRows.map((c) => c.category).filter(Boolean),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list promotional schemes", detail: String(err) });
    }
  });

  // POST /admin/promotions/schemes
  router.post("/promotions/schemes", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(3),
        headline: z.string().trim().min(3),
        description: z.string().trim().optional(),
        targetAmount: z.number().finite().nonnegative().default(0),
        discountAmount: z.number().finite().nonnegative().default(0),
        ruleType: z.enum(["order_value", "product_qty", "category_bags", "volume_slab", "category_weight"]).default("order_value"),
        minQuantity: z.number().int().positive().nullable().optional(),
        qualifyingVariantId: z.string().uuid().nullable().optional(),
        qualifyingCategory: z.string().trim().nullable().optional(),
        qualifyingWeightKg: z.number().finite().nonnegative().nullable().optional(),
        rewardType: z.enum(["flat_discount", "percentage_discount", "free_goods", "lowest_priced_category_sku"]).default("flat_discount"),
        rewardValue: z.number().finite().nonnegative().nullable().optional(),
        freeVariantId: z.string().uuid().nullable().optional(),
        freePackagingUnits: z.string().trim().nullable().optional(),
        targetAudience: z.enum(["all_retailers", "tier", "territory"]).default("all_retailers"),
        targetTierId: z.string().uuid().nullable().optional(),
        targetTerritory: z.string().trim().nullable().optional(),
        featured: z.boolean().default(false),
        active: z.boolean().default(true),
        startsAt: z.string().datetime().or(z.string().min(10)),
        endsAt: z.string().datetime().or(z.string().min(10)),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid scheme data", details: parsed.error.flatten() });
    }

    try {
      const data = parsed.data;
      const scheme = await prisma.scheme.create({
        data: {
          name: data.name,
          headline: data.headline,
          description: data.description || undefined,
          targetAmount: data.targetAmount,
          discountAmount: data.discountAmount,
          ruleType: data.ruleType,
          minQuantity: data.minQuantity || null,
          qualifyingVariantId: data.qualifyingVariantId || null,
          qualifyingCategory: data.qualifyingCategory || null,
          qualifyingWeightKg: data.qualifyingWeightKg ? data.qualifyingWeightKg : null,
          rewardType: data.rewardType,
          rewardValue: data.rewardValue || null,
          freeVariantId: data.freeVariantId || null,
          freePackagingUnits: data.freePackagingUnits || null,
          targetAudience: data.targetAudience,
          targetTierId: data.targetTierId || null,
          targetTerritory: data.targetTerritory || null,
          featured: data.featured,
          active: data.active,
          startsAt: new Date(data.startsAt),
          endsAt: new Date(data.endsAt),
        },
      });

      res.status(201).json({ ok: true, scheme });
    } catch (err) {
      res.status(500).json({ error: "Failed to create scheme", detail: String(err) });
    }
  });

  // PUT /admin/promotions/schemes/:id
  router.put("/promotions/schemes/:id", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(3).optional(),
        headline: z.string().trim().min(3).optional(),
        description: z.string().trim().optional(),
        targetAmount: z.number().finite().nonnegative().optional(),
        discountAmount: z.number().finite().nonnegative().optional(),
        ruleType: z.enum(["order_value", "product_qty", "category_bags", "volume_slab", "category_weight"]).optional(),
        minQuantity: z.number().int().positive().nullable().optional(),
        qualifyingVariantId: z.string().uuid().nullable().optional(),
        qualifyingCategory: z.string().trim().nullable().optional(),
        qualifyingWeightKg: z.number().finite().nonnegative().nullable().optional(),
        rewardType: z.enum(["flat_discount", "percentage_discount", "free_goods", "lowest_priced_category_sku"]).optional(),
        rewardValue: z.number().finite().nonnegative().nullable().optional(),
        freeVariantId: z.string().uuid().nullable().optional(),
        freePackagingUnits: z.string().trim().nullable().optional(),
        targetAudience: z.enum(["all_retailers", "tier", "territory"]).optional(),
        targetTierId: z.string().uuid().nullable().optional(),
        targetTerritory: z.string().trim().nullable().optional(),
        featured: z.boolean().optional(),
        active: z.boolean().optional(),
        startsAt: z.string().optional(),
        endsAt: z.string().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid scheme update", details: parsed.error.flatten() });
    }

    try {
      const data: any = { ...parsed.data };
      if (data.startsAt) data.startsAt = new Date(data.startsAt);
      if (data.endsAt) data.endsAt = new Date(data.endsAt);

      const scheme = await prisma.scheme.update({
        where: { id: req.params.id },
        data,
      });

      res.json({ ok: true, scheme });
    } catch (err) {
      res.status(500).json({ error: "Failed to update scheme", detail: String(err) });
    }
  });

  // POST /admin/promotions/schemes/:id/toggle-active
  router.post("/promotions/schemes/:id/toggle-active", async (req, res) => {
    try {
      const scheme = await prisma.scheme.findUnique({ where: { id: req.params.id } });
      if (!scheme) return res.status(404).json({ error: "Scheme not found" });

      const updated = await prisma.scheme.update({
        where: { id: req.params.id },
        data: { active: !scheme.active },
      });

      res.json({ ok: true, id: updated.id, active: updated.active });
    } catch (err) {
      res.status(500).json({ error: "Failed to toggle scheme status", detail: String(err) });
    }
  });

  // DELETE /admin/promotions/schemes/:id
  router.delete("/promotions/schemes/:id", async (req, res) => {
    try {
      await prisma.scheme.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete scheme", detail: String(err) });
    }
  });

  return router;
}
