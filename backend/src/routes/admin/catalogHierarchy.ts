import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createCatalogHierarchyRouter() {
  const router = Router();

  const ensureDefaultHierarchy = async () => {
    try {
      const catCount = await prisma.category.count();
      if (catCount === 0) {
        await prisma.category.createMany({
          data: [
            { name: "Pulses & Dals", slug: "pulses-dals", description: "Premium unpolished toor dal, moong, and chana dal", sortOrder: 1 },
            { name: "Edible Oils", slug: "edible-oils", description: "Refined soyabean, groundnut, and mustard oils", sortOrder: 2 },
            { name: "Atta & Flours", slug: "atta-flours", description: "Chakki fresh whole wheat atta, maida, and besan", sortOrder: 3 },
            { name: "Rice & Grains", slug: "rice-grains", description: "Daily & basmati varieties", sortOrder: 4 },
            { name: "Instant Mixes & Spices", slug: "instant-mixes-spices", description: "Gagan instant mixes, gulab jamun, and blended spices", sortOrder: 5 },
          ],
        });
      }

      const brandCount = await prisma.brand.count();
      if (brandCount === 0) {
        await prisma.brand.createMany({
          data: [
            { name: "Gagan", slug: "gagan", description: "Flagship commercial brand across staples and mixes", sortOrder: 1 },
            { name: "Laxmi", slug: "laxmi", description: "Premium pulse and grain varieties", sortOrder: 2 },
            { name: "Padam", slug: "padam", description: "High-grade regional commodities", sortOrder: 3 },
            { name: "Choice", slug: "choice", description: "Economy daily staples line", sortOrder: 4 },
            { name: "Classic", slug: "classic", description: "Specialty food service packs", sortOrder: 5 },
          ],
        });
      }
    } catch (err) {
      console.warn("Could not ensure default hierarchy:", err);
    }
  };

  void ensureDefaultHierarchy();

  // -------------------------------------------------------------
  // Categories
  router.get(["/categories", "/catalog/categories"], async (_req, res) => {
    try {
      const categories = await prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
      });

      // Count products matching category name
      const products = await prisma.product.findMany({ select: { category: true } });
      const counts: Record<string, number> = {};
      for (const p of products) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }

      res.json({
        categories: categories.map((c) => ({
          ...c,
          productCount: counts[c.name] || counts[c.slug] || 0,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list categories", detail: String(err) });
    }
  });

  router.post("/categories", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(2),
        slug: z.string().trim().min(2).optional(),
        description: z.string().trim().optional(),
        bannerUrl: z.string().trim().url().or(z.literal("")).optional(),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid category input" });

    const slug = (parsed.data.slug || parsed.data.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    try {
      const category = await prisma.category.create({
        data: {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          bannerUrl: parsed.data.bannerUrl || null,
          sortOrder: parsed.data.sortOrder,
          isActive: parsed.data.isActive,
        },
      });

      res.status(201).json({ category });
    } catch (err) {
      res.status(500).json({ error: "Failed to create category", detail: String(err) });
    }
  });

  router.put("/categories/:id", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(2).optional(),
        slug: z.string().trim().min(2).optional(),
        description: z.string().trim().nullable().optional(),
        bannerUrl: z.string().trim().nullable().optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid category update input" });

    try {
      const updated = await prisma.category.update({
        where: { id: req.params.id },
        data: parsed.data,
      });

      res.json({ category: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update category", detail: String(err) });
    }
  });

  router.delete("/categories/:id", async (req, res) => {
    try {
      await prisma.category.delete({ where: { id: req.params.id } });
      res.json({ ok: true, message: "Category deleted" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete category", detail: String(err) });
    }
  });

  // -------------------------------------------------------------
  // Brands
  router.get(["/brands", "/catalog/brands"], async (_req, res) => {
    try {
      const brands = await prisma.brand.findMany({
        orderBy: { sortOrder: "asc" },
      });

      const products = await prisma.product.findMany({ select: { catalogIdentityBrand: true } });
      const counts: Record<string, number> = {};
      for (const p of products) {
        if (p.catalogIdentityBrand) {
          counts[p.catalogIdentityBrand] = (counts[p.catalogIdentityBrand] || 0) + 1;
        }
      }

      res.json({
        brands: brands.map((b) => ({
          ...b,
          productCount: counts[b.name] || 0,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list brands", detail: String(err) });
    }
  });

  router.post("/brands", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(2),
        slug: z.string().trim().min(2).optional(),
        description: z.string().trim().optional(),
        logoUrl: z.string().trim().url().or(z.literal("")).optional(),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid brand input" });

    const slug = (parsed.data.slug || parsed.data.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    try {
      const brand = await prisma.brand.create({
        data: {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          logoUrl: parsed.data.logoUrl || null,
          sortOrder: parsed.data.sortOrder,
          isActive: parsed.data.isActive,
        },
      });

      res.status(201).json({ brand });
    } catch (err) {
      res.status(500).json({ error: "Failed to create brand", detail: String(err) });
    }
  });

  router.put("/brands/:id", async (req, res) => {
    const parsed = z
      .object({
        name: z.string().trim().min(2).optional(),
        slug: z.string().trim().min(2).optional(),
        description: z.string().trim().nullable().optional(),
        logoUrl: z.string().trim().nullable().optional(),
        sortOrder: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid brand update input" });

    try {
      const updated = await prisma.brand.update({
        where: { id: req.params.id },
        data: parsed.data,
      });

      res.json({ brand: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update brand", detail: String(err) });
    }
  });

  router.delete("/brands/:id", async (req, res) => {
    try {
      await prisma.brand.delete({ where: { id: req.params.id } });
      res.json({ ok: true, message: "Brand deleted" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete brand", detail: String(err) });
    }
  });

  return router;
}
