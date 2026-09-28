import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { publicMediaUrl } from "../../lib/media";
import { requireAdmin } from "../../lib/adminAuth";
import { catalogueImageState, catalogueOrderingState, catalogueStatusWhere } from "../../modules/catalog/catalogueVisibility";
import { validateDraftPack } from "../../modules/catalog/draftPack";
import { Prisma } from "@prisma/client";
import { DEFAULT_WAREHOUSE_CODE, INVENTORY_STALE_AFTER_MS, selectInventorySnapshot } from "../../modules/inventory/inventoryService";
import { CataloguePublicationError, deriveCataloguePublicationInput, publishDraftCatalogue, publishDraftCatalogueFromBusinessInput, publishExistingDraftCatalogueFromBusinessInput } from "../../modules/catalog/draftCataloguePublication";
import { enableOrdering, getOrderingSetup, OrderingSetupError, saveOrderingDraft } from "../../modules/catalog/orderingSetup";
import { CatalogueSkuError, saveCatalogueSku, type CatalogueSkuInput } from "../../modules/catalog/saveCatalogueSku";
import { normalizeCatalogueText } from "../../modules/catalog/catalogueIdentity";
import type { AdminRequest } from "../../lib/adminAuth";

const router = Router();
router.use(requireAdmin);

function setupFailure(error: unknown, res: import("express").Response) {
  if (error instanceof CatalogueSkuError) return res.status(error.status).json({ error: error.code });
  if (error instanceof CataloguePublicationError) return res.status(error.status).json({ error: error.code });
  if (error instanceof OrderingSetupError) return res.status(error.status).json({ error: error.code, blockers: error.blockers });
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Review the price, GST and billing values before saving." });
  if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || (error.code === "P2010" && error.meta?.code === "40001"))) return res.status(409).json({ error: "setup_changed", blockers: ["Another edit was saved at the same time. Reopen this pack and review the latest values."] });
  throw error;
}

router.get("/variants/:id/ordering-setup", async (req, res) => {
  try { res.json(await getOrderingSetup(req.params.id)); }
  catch (error) { return setupFailure(error, res); }
});

const setupRequest = z.object({ revision: z.string().length(64), values: z.unknown() });
router.put("/variants/:id/ordering-draft", async (req: AdminRequest, res) => {
  const parsed = setupRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_setup_request" });
  try { res.json(await saveOrderingDraft(req.params.id, parsed.data.revision, parsed.data.values, req.staffAuth!.staffId)); }
  catch (error) { return setupFailure(error, res); }
});

const publicationRequest = z.object({
  brandName: z.string().optional(),
  groupName: z.string().optional(),
  productLabel: z.string().optional(),
  skuName: z.string().optional(),
  packingSize: z.string().optional(),
  masterBagBoxSize: z.string().optional(),
}).strict();

router.post("/variants/:id/publish-catalogue", async (req: AdminRequest, res) => {
  const parsed = publicationRequest.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "semantic_identity_required" });
  try {
    const result = await publishDraftCatalogue(req.params.id, parsed.data, req.staffAuth!.staffId);
    if (result.outcome === "blocked") return res.status(409).json({ error: result.code, productId: result.productId, variantId: result.variantId });
    res.json(result);
  } catch (error) {
    return setupFailure(error, res);
  }
});

const businessVariantPublishSchema = z.object({ outerPack: z.enum(["Bag", "Box"]) }).strict();
router.post("/variants/:id/publish-catalogue-business", async (req: AdminRequest, res) => {
  const parsed = businessVariantPublishSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_outer_pack" });
  try {
    const result = await publishExistingDraftCatalogueFromBusinessInput(req.params.id, parsed.data.outerPack, req.staffAuth!.staffId);
    if (result.outcome === "blocked") return res.status(409).json({ error: result.code, productId: result.productId, variantId: result.variantId });
    res.json(result);
  } catch (error) {
    return setupFailure(error, res);
  }
});

router.post("/variants/:id/enable-ordering", async (req: AdminRequest, res) => {
  const parsed = setupRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_setup_request" });
  try { res.json(await enableOrdering(req.params.id, parsed.data.revision, parsed.data.values, req.staffAuth!.staffId)); }
  catch (error) { return setupFailure(error, res); }
});

const catalogueSkuRequest = z.object({
  productName: z.string().trim().min(1),
  brandName: z.string().trim().min(1),
  groupName: z.string().trim().min(1),
  category: z.string().trim().min(1),
  imageUrl: z.string().trim().url().nullable().optional(),
  packSize: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  unitsPerCase: z.number().int().positive(),
  measuredWeightKg: z.number().positive().nullable().optional(),
  outerPack: z.enum(["Bag", "Box"]),
  purchaseRate: z.number().min(0),
  purchaseRateBasis: z.enum(["case", "quintal"]),
  listRate: z.number().positive(),
  sellingRateBasis: z.enum(["case", "quintal"]),
  tiers: z.array(z.object({ tierId: z.string().min(1), price: z.number().min(0).nullable().optional(), discountPercent: z.number().nullable().optional() })).min(1),
  gstPercent: z.number().min(0),
  routingClass: z.enum(["LAXMI_TOOR", "INSTANT_MIX", "OTHER"]),
  routingBagEquivalent: z.number().positive().nullable().optional(),
  openingStockCases: z.number().min(0).nullable().optional(),
  warehouseCode: z.string().trim().min(1).optional(),
  active: z.boolean(),
  productId: z.string().min(1).nullable().optional(),
});

router.post("/catalogue-skus", async (req: AdminRequest, res) => {
  const parsed = catalogueSkuRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_catalogue_sku", details: parsed.error.flatten() });
  try { res.status(201).json(await saveCatalogueSku(parsed.data as CatalogueSkuInput, req.staffAuth!.staffId)); }
  catch (error) { return setupFailure(error, res); }
});

router.put("/catalogue-skus/:variantId", async (req: AdminRequest, res) => {
  const parsed = catalogueSkuRequest.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_catalogue_sku", details: parsed.error.flatten() });
  try { res.json(await saveCatalogueSku({ ...(parsed.data as CatalogueSkuInput), variantId: req.params.variantId }, req.staffAuth!.staffId)); }
  catch (error) { return setupFailure(error, res); }
});

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
  const snapshots = await prisma.inventorySnapshot.findMany({ where: { warehouseCode: DEFAULT_WAREHOUSE_CODE, productId: { in: products.map(product => product.id) } } });

  res.json({
    tiers,
    products: products.map((p) => ({
      id: p.id,
      catalogKey: p.catalogKey,
      internalCode: p.internalCode,
      catalogIdentityBrand: p.catalogIdentityBrand,
      catalogIdentityGroup: p.catalogIdentityGroup,
      catalogIdentityLabel: p.catalogIdentityLabel,
      catalogStatus: p.catalogStatus,
      name: p.name,
      category: p.category,
      imageUrl: publicMediaUrl(req, p.imageUrl),
      description: p.description,
      variants: p.variants.map((v) => ({
        stock: (() => {
          const snapshot = selectInventorySnapshot(p, v, snapshots.filter(row => row.productId === p.id));
          if (!snapshot) return { status: "needs_verification", available: null };
          if (Date.now() - snapshot.syncedAt.getTime() > INVENTORY_STALE_AFTER_MS) return { status: "needs_verification", available: Number(snapshot.available) };
          return { status: snapshot.status === "unavailable" || Number(snapshot.available) <= 0 ? "out_of_stock" : "in_stock", available: Number(snapshot.available) };
        })(),
        id: v.id,
        catalogKey: v.catalogKey,
        internalCode: v.internalCode,
        catalogIdentitySkuName: v.catalogIdentitySkuName,
        catalogIdentityPackingSize: v.catalogIdentityPackingSize,
        catalogIdentityMasterPack: v.catalogIdentityMasterPack,
        catalogStatus: v.catalogStatus,
        ...catalogueOrderingState(v.catalogStatus, v.gstPercent?.toString() ?? null, v.gstPendingOrderAllowed),
        ...catalogueImageState(v),
        imageUrl: publicMediaUrl(req, v.imageUrl),
        unitSize: v.unitSize,
        unit: v.unit,
        unitsPerCase: v.unitsPerCase,
        unitWeightKg: Number(v.unitWeightKg),
        hsnCode: v.hsnCode,
        sellingEntity:v.sellingEntity,gstPercent:v.gstPercent == null ? null : Number(v.gstPercent),
        purchaseRate: v.purchaseRate == null ? null : Number(v.purchaseRate),
        purchaseRateBasis: v.purchaseRateBasis,
        listRate: v.listRate == null ? null : Number(v.listRate),
        listRateBasis: v.listRateBasis,
        routingClass: v.routingClass,
        routingBagEquivalent: v.routingBagEquivalent == null ? null : Number(v.routingBagEquivalent),
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
  if (variant.catalogKey || variant.sellingEntity || variant.routingClass) return res.status(409).json({error:"Use Catalog ordering setup to review the rate basis, GST and billing rule"});

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
  brandName: z.string().trim().min(1).optional(),
  groupName: z.string().trim().min(1).optional(),
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
const businessPublishSchema = z.object({
  product: draftProductSchema.extend({ brandName: z.string().trim().min(1), groupName: z.string().trim().min(1) }),
  pack: draftVariantSchema.extend({ outerPack: z.enum(["Bag", "Box"]) }),
}).strict();

function draftProductData(input: z.infer<typeof draftProductSchema>) {
  const labelInput = input.brandName && input.groupName
    ? {
        product: { name: input.name, brandName: input.brandName, groupName: input.groupName, category: input.category },
        pack: { unitSize: "1 KG", unit: "kg", unitsPerCase: 1, unitWeightKg: 1, outerPack: "Bag" as const },
      }
    : null;
  const label = labelInput ? normalizeCatalogueText(deriveCataloguePublicationInput(labelInput).productLabel) : null;
  const { brandName, groupName, ...product } = input;
  return {
    ...product,
    ...(brandName ? { catalogIdentityBrand: brandName.trim().toUpperCase() } : {}),
    ...(groupName ? { catalogIdentityGroup: groupName.trim().toUpperCase() } : {}),
    ...(label ? { catalogIdentityLabel: label } : {}),
  };
}

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
      ...draftProductData(parsed.data),
      catalogStatus: "pending_review",
      variants: { create: parsed.data.variants.map((variant) => ({ ...variant, catalogStatus: "pending_review", catalogImageStatus: "pending", catalogImageLabel: "Image pending confirmation" })) },
    },
    include: { variants: true },
  });
  res.status(201).json({ product });
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: "catalog_identity_exists" });
    throw error;
  }
});

router.post("/products/publish", async (req: AdminRequest, res) => {
  const parsed = businessPublishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const errors = packErrors([parsed.data.pack]);
  if (errors.length) return res.status(400).json({ error: "invalid_pack", details: errors });
  try {
    const result = await publishDraftCatalogueFromBusinessInput(parsed.data, req.staffAuth!.staffId);
    if (result.outcome === "blocked") return res.status(409).json({ error: result.code, productId: result.productId, variantId: result.variantId });
    res.status(201).json(result);
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: "catalog_identity_exists" });
    return setupFailure(error, res);
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
    const product = await prisma.product.update({ where: { id: existing.id, catalogStatus: "pending_review" }, data: draftProductData(parsed.data) });
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
  if (!["pending_review", "published", "active"].includes(product.catalogStatus)) return res.status(409).json({ error: "draft_only" });
  const duplicate = await prisma.variant.findFirst({ where: { productId: product.id, unitSize: { equals: parsed.data.unitSize, mode: "insensitive" }, unitsPerCase: parsed.data.unitsPerCase } });
  if (duplicate) return res.status(409).json({ error: "duplicate_pack" });
  try {
    const variant = await prisma.variant.create({ data: { ...parsed.data, productId: product.id, catalogStatus: "pending_review", catalogKey: null, internalCode: null, catalogImageStatus: "pending", catalogImageLabel: "Image pending confirmation" } });
    res.status(201).json({ variant });
  } catch (error) {
    if (uniqueConflict(error)) return res.status(409).json({ error: "duplicate_pack" });
    throw error;
  }
});

export default router;
