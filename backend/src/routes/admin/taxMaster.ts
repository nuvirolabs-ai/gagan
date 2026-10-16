import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";

export function createTaxMasterRouter() {
  const router = Router();

  const ensureDefaultHsnCodes = async () => {
    try {
      const count = await prisma.hsnMaster.count();
      if (count === 0) {
        await prisma.hsnMaster.createMany({
          data: [
            {
              code: "0713",
              description: "Dried Leguminous Vegetables / Pulses, Toor Dal & Chana",
              gstPercent: 5.0,
              isExempt: false,
              exemptionNotes: "0% for unbranded/loose grains; 5% for pre-packaged branded goods",
              chapter: "Chapter 07 - Edible Vegetables",
            },
            {
              code: "1006",
              description: "Rice, Broken Rice & Basmati",
              gstPercent: 5.0,
              isExempt: false,
              exemptionNotes: "0% for loose commodity; 5% for pre-packaged",
              chapter: "Chapter 10 - Cereals",
            },
            {
              code: "1101",
              description: "Wheat or Meslin Flour, Atta, Maida & Suji",
              gstPercent: 5.0,
              isExempt: false,
              chapter: "Chapter 11 - Milling Industry Products",
            },
            {
              code: "1507",
              description: "Soya-bean Oil and its Fractions, Refined Edible Oil",
              gstPercent: 5.0,
              isExempt: false,
              chapter: "Chapter 15 - Animal or Vegetable Fats and Oils",
            },
            {
              code: "2106",
              description: "Food Preparations, Instant Mixes, Gulab Jamun & Spices",
              gstPercent: 18.0,
              isExempt: false,
              chapter: "Chapter 21 - Miscellaneous Edible Preparations",
            },
          ],
        });
      }
    } catch (err) {
      console.warn("Could not ensure default HSN codes:", err);
    }
  };

  void ensureDefaultHsnCodes();

  // GET /admin/tax/hsn or /admin/tax/hsn-codes
  router.get(["/tax/hsn", "/tax/hsn-codes"], async (_req, res) => {
    try {
      const [hsnCodes, variants] = await Promise.all([
        prisma.hsnMaster.findMany({ orderBy: { code: "asc" } }),
        prisma.variant.findMany({
          select: { id: true, hsnCode: true, gstPercent: true, product: { select: { name: true } }, unitSize: true, unitsPerCase: true },
        }),
      ]);

      const counts: Record<string, number> = {};
      for (const v of variants) {
        if (v.hsnCode) {
          counts[v.hsnCode] = (counts[v.hsnCode] || 0) + 1;
        }
      }

      res.json({
        hsnCodes: hsnCodes.map((h) => {
          const rate = Number(h.gstPercent);
          return {
            id: h.id,
            code: h.code,
            description: h.description,
            gstPercent: rate,
            cgstPercent: rate / 2,
            sgstPercent: rate / 2,
            igstPercent: rate,
            isExempt: h.isExempt,
            exemptionNotes: h.exemptionNotes,
            chapter: h.chapter,
            mappedVariantsCount: counts[h.code] || 0,
          };
        }),
        variantsWithoutHsn: variants.filter((v) => !v.hsnCode).length,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to list HSN codes", detail: String(err) });
    }
  });

  // POST /admin/tax/hsn
  router.post("/tax/hsn", async (req, res) => {
    const parsed = z
      .object({
        code: z.string().trim().min(4).max(10),
        description: z.string().trim().min(3),
        gstPercent: z.number().min(0).max(100),
        isExempt: z.boolean().default(false),
        exemptionNotes: z.string().trim().nullable().optional(),
        chapter: z.string().trim().nullable().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid HSN code parameters" });

    try {
      const existing = await prisma.hsnMaster.findUnique({ where: { code: parsed.data.code } });
      if (existing) return res.status(400).json({ error: "HSN code already exists" });

      const hsn = await prisma.hsnMaster.create({
        data: {
          code: parsed.data.code,
          description: parsed.data.description,
          gstPercent: parsed.data.gstPercent,
          isExempt: parsed.data.isExempt,
          exemptionNotes: parsed.data.exemptionNotes ?? null,
          chapter: parsed.data.chapter ?? null,
        },
      });

      res.status(201).json({ hsn });
    } catch (err) {
      res.status(500).json({ error: "Failed to create HSN code", detail: String(err) });
    }
  });

  // PUT /admin/tax/hsn/:id
  router.put("/tax/hsn/:id", async (req, res) => {
    const parsed = z
      .object({
        code: z.string().trim().min(4).max(10).optional(),
        description: z.string().trim().min(3).optional(),
        gstPercent: z.number().min(0).max(100).optional(),
        isExempt: z.boolean().optional(),
        exemptionNotes: z.string().trim().nullable().optional(),
        chapter: z.string().trim().nullable().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid HSN update parameters" });

    try {
      const updated = await prisma.hsnMaster.update({
        where: { id: req.params.id },
        data: parsed.data,
      });

      res.json({ hsn: updated });
    } catch (err) {
      res.status(500).json({ error: "Failed to update HSN code", detail: String(err) });
    }
  });

  // DELETE /admin/tax/hsn/:id
  router.delete("/tax/hsn/:id", async (req, res) => {
    try {
      await prisma.hsnMaster.delete({ where: { id: req.params.id } });
      res.json({ ok: true, message: "HSN code deleted" });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete HSN code", detail: String(err) });
    }
  });

  // POST /admin/tax/apply-hsn-to-variants
  router.post("/tax/apply-hsn-to-variants", async (req, res) => {
    const parsed = z
      .object({
        hsnCode: z.string().trim().min(4),
        variantIds: z.array(z.string().uuid()),
      })
      .safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "Invalid parameters" });

    try {
      const hsn = await prisma.hsnMaster.findUnique({ where: { code: parsed.data.hsnCode } });
      if (!hsn) return res.status(404).json({ error: "HSN code not found" });

      const updated = await prisma.variant.updateMany({
        where: { id: { in: parsed.data.variantIds } },
        data: {
          hsnCode: hsn.code,
          gstPercent: hsn.gstPercent,
        },
      });

      res.json({
        ok: true,
        message: `Updated ${updated.count} SKU variant(s) to HSN ${hsn.code} (${Number(hsn.gstPercent)}% GST)`,
        count: updated.count,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to map HSN to variants", detail: String(err) });
    }
  });

  return router;
}
