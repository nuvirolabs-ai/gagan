import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createTiersRouter() {
  const router = Router();

  // Seed default quantity slabs if none exist
  const ensureDefaultSlabs = async () => {
    try {
      const slabCount = await prisma.tierQuantitySlab.count();
      if (slabCount === 0) {
        const tiers = await prisma.tier.findMany();
        for (const t of tiers) {
          if (t.name.toLowerCase().includes("gold")) {
            await prisma.tierQuantitySlab.createMany({
              data: [
                { tierId: t.id, minQuantity: 1, maxQuantity: 19, discountPct: 0, notes: "Standard slab" },
                { tierId: t.id, minQuantity: 20, maxQuantity: 49, discountPct: 2.0, notes: "Volume discount" },
                { tierId: t.id, minQuantity: 50, maxQuantity: null, discountPct: 3.5, notes: "Wholesale bulk slab" },
              ],
            });
          } else if (t.name.toLowerCase().includes("platinum")) {
            await prisma.tierQuantitySlab.createMany({
              data: [
                { tierId: t.id, minQuantity: 1, maxQuantity: 19, discountPct: 1.0, notes: "Privileged base" },
                { tierId: t.id, minQuantity: 20, maxQuantity: 49, discountPct: 3.0, notes: "Super volume" },
                { tierId: t.id, minQuantity: 50, maxQuantity: null, discountPct: 5.0, notes: "Key account bulk" },
              ],
            });
          } else {
            await prisma.tierQuantitySlab.createMany({
              data: [
                { tierId: t.id, minQuantity: 1, maxQuantity: 29, discountPct: 0, notes: "Standard single rate" },
                { tierId: t.id, minQuantity: 30, maxQuantity: null, discountPct: 1.5, notes: "Bulk order reward" },
              ],
            });
          }
        }
      }
    } catch (err) {
      console.warn("Could not ensure default tier slabs:", err);
    }
  };

  void ensureDefaultSlabs();

  // GET /admin/commercial/tiers
  router.get("/commercial/tiers", async (_req, res) => {
    try {
      const tiers = await prisma.tier.findMany({
        include: {
          slabs: {
            orderBy: { minQuantity: "asc" },
          },
          _count: {
            select: { retailers: true, priceList: true },
          },
        },
        orderBy: { name: "asc" },
      });

      res.json({
        tiers: tiers.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          paymentTermDays: t.paymentTermDays,
          retailerCount: t._count.retailers,
          pricedSkusCount: t._count.priceList,
          slabs: t.slabs.map((s) => ({
            id: s.id,
            tierId: s.tierId,
            minQuantity: s.minQuantity,
            maxQuantity: s.maxQuantity,
            discountPct: Number(s.discountPct),
            discountFlat: s.discountFlat ? Number(s.discountFlat) : null,
            notes: s.notes,
          })),
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list tiers", detail: String(err) });
    }
  });

  // POST /admin/commercial/tiers
  router.post("/commercial/tiers", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(2),
        description: z.string().trim().optional(),
        paymentTermDays: z.number().int().min(0).max(180).default(15),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid tier input" });

    try {
      const existing = await prisma.tier.findUnique({ where: { name: parsed.data.name } });
      if (existing) return res.status(400).json({ error: "Tier with this name already exists" });

      const tier = await prisma.tier.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          paymentTermDays: parsed.data.paymentTermDays,
        },
      });

      res.status(201).json({ tier });
    } catch (err) {
      res.status(500).json({ error: "Failed to create tier", detail: String(err) });
    }
  });

  // PUT /admin/commercial/tiers/:id
  router.put("/commercial/tiers/:id", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(2).optional(),
        description: z.string().trim().nullable().optional(),
        paymentTermDays: z.number().int().min(0).max(180).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    try {
      const updated = await prisma.tier.update({
        where: { id: req.params.id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.paymentTermDays !== undefined ? { paymentTermDays: parsed.data.paymentTermDays } : {}),
        },
      });

      res.json({ tier: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update tier", detail: String(err) });
    }
  });

  // DELETE /admin/commercial/tiers/:id
  router.delete("/commercial/tiers/:id", async (req, res) => {
    try {
      const retailerCount = await prisma.retailer.count({ where: { tierId: req.params.id } });
      if (retailerCount > 0) {
        return res.status(400).json({
          error: `Cannot delete tier: ${retailerCount} active retailer(s) are assigned to it. Reassign retailers first.`,
        });
      }

      await prisma.tier.delete({ where: { id: req.params.id } });
      res.json({ ok: true, message: "Tier deleted" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete tier", detail: String(err) });
    }
  });

  // POST /admin/commercial/tiers/:id/slabs
  router.post("/commercial/tiers/:id/slabs", async (req, res) => {
    const parsed = z
      .object({
        minQuantity: z.number().int().min(1),
        maxQuantity: z.number().int().min(1).nullable().optional(),
        discountPct: z.number().min(0).max(100).default(0),
        discountFlat: z.number().min(0).nullable().optional(),
        notes: z.string().trim().nullable().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid slab parameters" });

    try {
      const slab = await prisma.tierQuantitySlab.create({
        data: {
          tierId: req.params.id,
          minQuantity: parsed.data.minQuantity,
          maxQuantity: parsed.data.maxQuantity ?? null,
          discountPct: parsed.data.discountPct,
          discountFlat: parsed.data.discountFlat ?? null,
          notes: parsed.data.notes ?? null,
        },
      });

      res.status(201).json({ slab });
    } catch (err) {
      res.status(500).json({ error: "Failed to create quantity slab", detail: String(err) });
    }
  });

  // PUT /admin/commercial/tiers/:id/slabs/:slabId
  router.put("/commercial/tiers/:id/slabs/:slabId", async (req, res) => {
    const parsed = z
      .object({
        minQuantity: z.number().int().min(1).optional(),
        maxQuantity: z.number().int().min(1).nullable().optional(),
        discountPct: z.number().min(0).max(100).optional(),
        discountFlat: z.number().min(0).nullable().optional(),
        notes: z.string().trim().nullable().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid slab parameters" });

    try {
      const slab = await prisma.tierQuantitySlab.update({
        where: { id: req.params.slabId },
        data: {
          ...(parsed.data.minQuantity !== undefined ? { minQuantity: parsed.data.minQuantity } : {}),
          ...(parsed.data.maxQuantity !== undefined ? { maxQuantity: parsed.data.maxQuantity } : {}),
          ...(parsed.data.discountPct !== undefined ? { discountPct: parsed.data.discountPct } : {}),
          ...(parsed.data.discountFlat !== undefined ? { discountFlat: parsed.data.discountFlat } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        },
      });

      res.json({ slab });
    } catch (err) {
      res.status(500).json({ error: "Failed to update quantity slab", detail: String(err) });
    }
  });

  // DELETE /admin/commercial/tiers/:id/slabs/:slabId
  router.delete("/commercial/tiers/:id/slabs/:slabId", async (req, res) => {
    try {
      await prisma.tierQuantitySlab.delete({ where: { id: req.params.slabId } });
      res.json({ ok: true, message: "Slab deleted" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete quantity slab", detail: String(err) });
    }
  });

  return router;
}
