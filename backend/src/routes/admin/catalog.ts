import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { publicMediaUrl } from "../../lib/media";
import { requireAdmin } from "../../lib/adminAuth";
import { catalogueImageState, catalogueOrderingState, catalogueStatusWhere } from "../../modules/catalog/catalogueVisibility";
import { validateDraftPack } from "../../modules/catalog/draftPack";
import { Prisma } from "@prisma/client";

const router = Router();
router.use(requireAdmin);

router.get("/products", async (req, res) => {
  const includeInactive = req.query.view === "all";
  const [products, tiers, priceList] = await Promise.all([
    prisma.product.findMany({
      ...(includeInactive ? {} : { where: { catalogStatus: catalogueStatusWhere(), variants: { some: { catalogStatus: catalogueStatusWhere() } } } }),
      include: { variants: includeInactive ? true : { where: { catalogStatus: catalogueStatusWhere() } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tier.findMany({ orderBy: { name: "asc" } }),
    prisma.priceList.findMany(),
  ]);

  const priceKey = (tierId: string, variantId: string) => `${tierId}:${variantId}`;
  const prices = new Map(priceList.map((p) => [priceKey(p.tierId, p.variantId), Number(p.price)]));

  res.json({
    tiers,
    products: products.map((p) => ({
      id: p.id,
      catalogKey: p.catalogKey,
      internalCode: p.internalCode,
      catalogStatus: p.catalogStatus,
      name: p.name,
      category: p.category,
      imageUrl: publicMediaUrl(req, p.imageUrl),
      description: p.description,
      variants: p.variants.map((v) => ({
        id: v.id,
        catalogKey: v.catalogKey,
        internalCode: v.internalCode,
        catalogStatus: v.catalogStatus,
        ...catalogueOrderingState(v.catalogStatus, v.gstPercent?.toString() ?? null, v.gstPendingOrderAllowed),
        ...catalogueImageState(v),
        imageUrl: publicMediaUrl(req, v.imageUrl),
        unitSize: v.unitSize,
        unit: v.unit,
        unitsPerCase: v.unitsPerCase,
        unitWeightKg: Number(v.unitWeightKg),
        hsnCode: v.hsnCode,
        sellingEntity:v.sellingEntity,gstPercent:v.gstPercent,
        prices: tiers.map((t) => ({
          tierId: t.id,
          tierName: t.name,
          price: prices.get(priceKey(t.id, v.id)) ?? null,
          rateBasis:priceList.find(p=>p.tierId===t.id && p.variantId===v.id)?.rateBasis ?? "case",
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
  if (variant.catalogStatus === "pending_review") return res.status(409).json({ error: "draft_commercial_configuration_required" });
  if (variant.sellingEntity) return res.status(409).json({error:"Use Commercial configuration to explicitly review the rate basis and GST"});

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
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  imageUrl: z.string().url().optional(),
  description: z.string().max(2000).optional(),
  variants: z.array(z.object({
    unitSize: z.string().trim().min(1),
    unit: z.string().trim().min(1),
    unitsPerCase: z.number().int().positive(),
    unitWeightKg: z.number().positive(),
  })).min(1),
});

const draftProductSchema = productSchema.omit({ variants: true });
const draftVariantSchema = productSchema.shape.variants.element;

function packErrors(packs: z.infer<typeof draftVariantSchema>[]) {
  return packs.flatMap((pack, index) => validateDraftPack(pack).errors.map((error) => ({ index, error })));
}

const packKey = (pack: { unitSize: string; unitsPerCase: number }) => `${pack.unitSize.trim().toLowerCase()}|${pack.unitsPerCase}`;
const uniqueConflict = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

router.post("/products", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const errors = packErrors(parsed.data.variants);
  if (errors.length) return res.status(400).json({ error: "invalid_pack", details: errors });
  const packs = parsed.data.variants.map(packKey);
  if (new Set(packs).size !== packs.length) return res.status(409).json({ error: "duplicate_pack" });
  const existing = await prisma.product.findMany({ where: { name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
  if (existing.length) return res.status(409).json({ error: "product_name_exists" });

  try { const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      catalogStatus: "pending_review",
      imageUrl: parsed.data.imageUrl,
      description: parsed.data.description,
      variants: { create: parsed.data.variants.map((variant) => ({ ...variant, catalogStatus: "pending_review" })) },
    },
    include: { variants: true },
  });
  res.status(201).json({ product });
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: "catalog_identity_exists" });
    throw error;
  }
});

router.put("/products/:id", async (req, res) => {
  const parsed = draftProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_product", details: parsed.error.flatten() });
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "product_not_found" });
  if (existing.catalogStatus !== "pending_review") return res.status(409).json({ error: "draft_only" });
  const matches = await prisma.product.findMany({ where: { name: { equals: parsed.data.name, mode: "insensitive" } }, select: { id: true } });
  if (matches.some((match) => match.id !== existing.id)) return res.status(409).json({ error: "product_name_exists" });
  try {
    const product = await prisma.product.update({ where: { id: existing.id, catalogStatus: "pending_review" }, data: parsed.data });
    res.json({ product });
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: "product_name_exists" });
    throw error;
  }
});

router.put("/variants/:id", async (req, res) => {
  const parsed = draftVariantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_pack", details: parsed.error.flatten() });
  const errors = packErrors([parsed.data]);
  if (errors.length) return res.status(400).json({ error: "invalid_pack", details: errors });
  const existing = await prisma.variant.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "variant_not_found" });
  if (existing.catalogStatus !== "pending_review") return res.status(409).json({ error: "draft_only" });
  const duplicate = await prisma.variant.findFirst({ where: { productId: existing.productId, unitSize: { equals: parsed.data.unitSize, mode: "insensitive" }, unitsPerCase: parsed.data.unitsPerCase, id: { not: existing.id } } });
  if (duplicate) return res.status(409).json({ error: "duplicate_pack" });
  try {
    const variant = await prisma.variant.update({ where: { id: existing.id, catalogStatus: "pending_review" }, data: parsed.data });
    res.json({ variant });
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: "duplicate_pack" });
    throw error;
  }
});

router.post("/products/:id/variants", async (req, res) => {
  const parsed = draftVariantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_pack", details: parsed.error.flatten() });
  const errors = packErrors([parsed.data]);
  if (errors.length) return res.status(400).json({ error: "invalid_pack", details: errors });
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "product_not_found" });
  if (product.catalogStatus !== "pending_review") return res.status(409).json({ error: "draft_only" });
  const duplicate = await prisma.variant.findFirst({ where: { productId: product.id, unitSize: { equals: parsed.data.unitSize, mode: "insensitive" }, unitsPerCase: parsed.data.unitsPerCase } });
  if (duplicate) return res.status(409).json({ error: "duplicate_pack" });
  try {
    const variant = await prisma.variant.create({ data: { ...parsed.data, productId: product.id, catalogStatus: "pending_review" } });
    res.status(201).json({ variant });
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: "duplicate_pack" });
    throw error;
  }
});

export default router;
