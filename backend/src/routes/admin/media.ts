import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createMediaRouter() {
  const router = Router();

  // GET /admin/catalog/media
  router.get("/catalog/media", async (_req, res) => {
    try {
      const products = await prisma.product.findMany({
        where: {
          catalogStatus: { notIn: ["archived", "deleted"] },
          variants: { some: { catalogStatus: { notIn: ["archived", "deleted"] } } },
        },
        include: {
          variants: {
            where: { catalogStatus: { notIn: ["archived", "deleted"] } },
            select: {
              id: true,
              unitSize: true,
              unit: true,
              unitsPerCase: true,
              imageUrl: true,
              catalogImageStatus: true,
              catalogImageLabel: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      let totalProducts = products.length;
      let productsWithImage = 0;
      let totalVariants = 0;
      let variantsWithImage = 0;

      const mediaItems = products.map((p) => {
        const hasImg = Boolean(p.imageUrl && p.imageUrl.trim());
        if (hasImg) productsWithImage++;

        const variantList = p.variants.map((v) => {
          totalVariants++;
          const vHasImg = Boolean(v.imageUrl && v.imageUrl.trim());
          if (vHasImg) variantsWithImage++;
          return {
            id: v.id,
            pack: `${v.unitSize} × ${v.unitsPerCase}`,
            imageUrl: v.imageUrl,
            hasImage: vHasImg,
            imageStatus: v.catalogImageStatus,
            imageLabel: v.catalogImageLabel,
          };
        });

        return {
          id: p.id,
          name: p.name,
          category: p.category,
          brand: p.catalogIdentityBrand || "Gagan",
          imageUrl: p.imageUrl,
          hasImage: hasImg,
          variants: variantList,
          missingVariantsCount: variantList.filter((v) => !v.hasImage).length,
          totalVariants: variantList.length,
        };
      });

      res.json({
        metrics: {
          totalProducts,
          productsWithImage,
          productsMissingImage: totalProducts - productsWithImage,
          totalVariants,
          variantsWithImage,
          variantsMissingImage: totalVariants - variantsWithImage,
        },
        products: mediaItems,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to load product media", detail: String(err) });
    }
  });

  // POST /admin/catalog/products/:id/image
  router.post("/catalog/products/:id/image", async (req, res) => {
    const parsed = z
      .object({
        imageUrl: z.string().trim().url().or(z.literal("")),
        cascadeToVariants: z.boolean().default(false),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid image URL" });

    try {
      const updated = await prisma.product.update({
        where: { id: req.params.id },
        data: { imageUrl: parsed.data.imageUrl || null },
      });

      if (parsed.data.cascadeToVariants) {
        await prisma.variant.updateMany({
          where: { productId: req.params.id },
          data: { imageUrl: parsed.data.imageUrl || null },
        });
      }

      res.json({ ok: true, product: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update product image", detail: String(err) });
    }
  });

  // POST /admin/catalog/variants/:id/image
  router.post("/catalog/variants/:id/image", async (req, res) => {
    const parsed = z
      .object({
        imageUrl: z.string().trim().url().or(z.literal("")),
        catalogImageLabel: z.string().trim().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid image URL" });

    try {
      const updated = await prisma.variant.update({
        where: { id: req.params.id },
        data: {
          imageUrl: parsed.data.imageUrl || null,
          ...(parsed.data.catalogImageLabel ? { catalogImageLabel: parsed.data.catalogImageLabel } : {}),
        },
      });

      res.json({ ok: true, variant: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update variant image", detail: String(err) });
    }
  });

  return router;
}
