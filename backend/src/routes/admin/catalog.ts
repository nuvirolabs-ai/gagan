import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { publicMediaUrl } from "../../lib/media";
import { requireAnyAdminPermission } from "../../lib/adminAuth";
import { Permissions } from "../../modules/identity/roleCatalog";
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
router.use(requireAnyAdminPermission(Permissions.STAFF_MANAGE, Permissions.CATALOG_MANAGE));

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
  const [products, tiers, priceList, drafts] = await Promise.all([
    prisma.product.findMany({
      where: includeInactive
        ? {
            catalogStatus: { notIn: ["archived", "deleted"] },
            variants: { some: { catalogStatus: { notIn: ["archived", "deleted"] } } },
          }
        : {
            catalogStatus: catalogueStatusWhere(),
            variants: { some: { catalogStatus: catalogueStatusWhere() } },
          },
      include: {
        variants: includeInactive
          ? { where: { catalogStatus: { notIn: ["archived", "deleted"] } } }
          : { where: { catalogStatus: catalogueStatusWhere() } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tier.findMany({ orderBy: { name: "asc" } }),
    prisma.priceList.findMany(),
    prisma.catalogOrderingDraft.findMany(),
  ]);

  const draftsMap = new Map((drafts || []).map((d) => {
    const val = (d.values as any) || {};
    return [d.variantId, {
      discount: Number(val.discount || 0),
      discountType: (val.discountType === "percent" ? "percent" : "flat") as "flat" | "percent",
    }];
  }));
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
        discount: draftsMap.get(v.id)?.discount ?? 0,
        discountType: draftsMap.get(v.id)?.discountType ?? "flat",
        routingClass: v.routingClass,
        routingBagEquivalent: v.routingBagEquivalent == null ? null : Number(v.routingBagEquivalent),
        prices: tiers.map((t) => {
          const pl = priceList.find((p) => p.tierId === t.id && p.variantId === v.id);
          return {
            tierId: t.id,
            tierName: t.name,
            price: prices.get(priceKey(t.id, v.id)) ?? (v.listRate != null ? Number(v.listRate) : null),
            rateBasis: (v.listRateBasis === "quintal" || pl?.rateBasis === "quintal") ? "quintal" : (pl?.rateBasis ?? v.listRateBasis ?? "case"),
          };
        }),
      })),
    })),
  });
});

const priceSchema = z.object({
  tierId: z.string(),
  variantId: z.string(),
  price: z.number().min(0),
  rateBasis: z.enum(["case", "quintal"]).optional(),
});

router.post("/price-list", async (req, res) => {
  const parsed = priceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const variant = await prisma.variant.findUnique({ where: { id: parsed.data.variantId } });
  if (!variant) return res.status(404).json({ error: "Variant not found" });

  const targetRateBasis = parsed.data.rateBasis ?? variant.listRateBasis ?? "case";

  // Update all tiers with this price so there is only one consistent price across the platform
  const tiers = await prisma.tier.findMany();
  await Promise.all(
    tiers.map((t) =>
      prisma.priceList.upsert({
        where: { tierId_variantId: { tierId: t.id, variantId: parsed.data.variantId } },
        update: {
          price: parsed.data.price,
          ...(parsed.data.rateBasis ? { rateBasis: parsed.data.rateBasis } : {}),
        },
        create: {
          tierId: t.id,
          variantId: parsed.data.variantId,
          productId: variant.productId,
          price: parsed.data.price,
          rateBasis: targetRateBasis,
        },
      })
    )
  );

  await prisma.variant.update({
    where: { id: variant.id },
    data: {
      listRate: parsed.data.price,
      ...(parsed.data.rateBasis ? { listRateBasis: parsed.data.rateBasis } : {}),
    },
  });

  const row = await prisma.priceList.findUnique({
    where: { tierId_variantId: { tierId: parsed.data.tierId, variantId: parsed.data.variantId } },
  });
  res.json({ price: row });
});

const quickEditSchema = z.object({
  price: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  discountType: z.enum(["flat", "percent"]).optional(),
  rateBasis: z.enum(["case", "quintal"]).optional(),
  packSize: z.coerce.string().trim().optional(),
  unit: z.string().trim().optional(),
  unitsPerCase: z.coerce.number().int().positive().optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
  routingClass: z.enum(["LAXMI_TOOR", "INSTANT_MIX", "OTHER"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

router.put("/variants/:id/quick-edit", async (req: AdminRequest, res) => {
  const parsed = quickEditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const existing = await prisma.variant.findUnique({
    where: { id: req.params.id },
    include: { product: true },
  });
  if (!existing) return res.status(404).json({ error: "variant_not_found" });

  const updateData: any = {};

  if (parsed.data.packSize && parsed.data.unit) {
    const size = Number(parsed.data.packSize);
    const unit = parsed.data.unit.toLowerCase();
    const massFactor = unit === "quintal" ? 100 : unit === "g" ? 0.001 : 1;
    const unitWeightKg = unit === "pcs" ? (existing.unitWeightKg ? Number(existing.unitWeightKg) : 1) : size * massFactor;
    updateData.unitSize = `${size} ${unit}`;
    updateData.unit = unit;
    updateData.unitWeightKg = unitWeightKg;
  }
  if (parsed.data.unitsPerCase) {
    updateData.unitsPerCase = parsed.data.unitsPerCase;
  }
  if (parsed.data.gstPercent !== undefined) {
    updateData.gstPercent = parsed.data.gstPercent;
    updateData.gstPendingOrderAllowed = false;
  }
  if (parsed.data.routingClass) {
    updateData.routingClass = parsed.data.routingClass;
  }
  if (parsed.data.price !== undefined) {
    updateData.listRate = parsed.data.price;
  }
  if (parsed.data.rateBasis !== undefined) {
    updateData.listRateBasis = parsed.data.rateBasis;
  }

  if (parsed.data.discount !== undefined) {
    const discountType = parsed.data.discountType ?? "flat";
    await prisma.catalogOrderingDraft.upsert({
      where: { variantId: existing.id },
      update: {
        values: { discount: parsed.data.discount, discountType },
        updatedByStaffId: (req as any).staffAuth?.staffId ?? (req as any).admin?.id ?? "admin",
      },
      create: {
        variantId: existing.id,
        values: { discount: parsed.data.discount, discountType },
        updatedByStaffId: (req as any).staffAuth?.staffId ?? (req as any).admin?.id ?? "admin",
      },
    });
  }

  if (parsed.data.status !== undefined) {
    updateData.catalogStatus = parsed.data.status;
  } else if (existing.catalogStatus === "pending_review") {
    updateData.catalogStatus = "active";
  }

  const updatedVariant = await prisma.variant.update({
    where: { id: existing.id },
    data: updateData,
  });

  if (parsed.data.status === "active" && existing.product.catalogStatus === "inactive") {
    await prisma.product.update({
      where: { id: existing.productId },
      data: { catalogStatus: "active" },
    });
  }

  if (parsed.data.price !== undefined || parsed.data.rateBasis !== undefined) {
    const tiers = await prisma.tier.findMany();
    const targetRateBasis = parsed.data.rateBasis ?? existing.listRateBasis ?? "case";
    const targetPrice = parsed.data.price !== undefined ? parsed.data.price : (existing.listRate != null ? Number(existing.listRate) : 0);

    await Promise.all(
      tiers.map((t) => {
        const updateObj: Prisma.PriceListUpdateInput = {};
        if (parsed.data.price !== undefined) updateObj.price = parsed.data.price;
        if (parsed.data.rateBasis !== undefined) updateObj.rateBasis = parsed.data.rateBasis;
        return prisma.priceList.upsert({
          where: { tierId_variantId: { tierId: t.id, variantId: existing.id } },
          update: updateObj,
          create: {
            tierId: t.id,
            variantId: existing.id,
            productId: existing.productId,
            price: targetPrice,
            rateBasis: targetRateBasis,
          },
        });
      })
    );
  }

  res.json({ success: true, variant: updatedVariant });
});

const quickEditProductSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  imageUrl: z.string().trim().nullable().optional(),
  brandName: z.string().trim().optional(),
  groupName: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

router.put("/products/:id/quick-edit", async (req: AdminRequest, res) => {
  const parsed = quickEditProductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const existing = await prisma.product.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) return res.status(404).json({ error: "product_not_found" });

  const duplicate = await prisma.product.findFirst({
    where: {
      name: { equals: parsed.data.name, mode: "insensitive" },
      id: { not: existing.id },
    },
  });
  if (duplicate) return res.status(409).json({ error: "product_name_exists" });

  const updatedProduct = await prisma.product.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl || null } : {}),
      ...(parsed.data.brandName ? { catalogIdentityBrand: parsed.data.brandName.trim().toUpperCase() } : {}),
      ...(parsed.data.groupName ? { catalogIdentityGroup: parsed.data.groupName.trim().toUpperCase() } : {}),
      ...(parsed.data.status ? { catalogStatus: parsed.data.status } : {}),
    },
  });

  if (parsed.data.status) {
    await prisma.variant.updateMany({
      where: {
        productId: existing.id,
        catalogStatus: { notIn: ["archived", "deleted"] },
      },
      data: { catalogStatus: parsed.data.status },
    });
  }

  res.json({ success: true, product: updatedProduct });
});

const statusUpdateSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

router.put("/products/:id/status", async (req: AdminRequest, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status", details: parsed.error.flatten() });

  const existing = await prisma.product.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) return res.status(404).json({ error: "product_not_found" });

  const [updatedProduct] = await prisma.$transaction([
    prisma.product.update({
      where: { id: existing.id },
      data: { catalogStatus: parsed.data.status },
    }),
    prisma.variant.updateMany({
      where: {
        productId: existing.id,
        catalogStatus: { notIn: ["archived", "deleted"] },
      },
      data: { catalogStatus: parsed.data.status },
    }),
  ]);

  res.json({ success: true, product: updatedProduct });
});

router.delete("/products/:id", async (req: AdminRequest, res) => {
  const existing = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { variants: true },
  });
  if (!existing) return res.status(404).json({ error: "product_not_found" });

  const variantIds = existing.variants.map((v) => v.id);

  const [orderItemsCount, intentItemsCount] = await Promise.all([
    prisma.orderItem.count({ where: { variantId: { in: variantIds } } }),
    prisma.retailerProposalOrderIntentItem.count({ where: { variantId: { in: variantIds } } }),
  ]);

  if (orderItemsCount > 0 || intentItemsCount > 0) {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: existing.id },
        data: { catalogStatus: "archived" },
      }),
      prisma.variant.updateMany({
        where: { productId: existing.id },
        data: { catalogStatus: "archived" },
      }),
    ]);
    return res.json({ success: true, mode: "archived", id: existing.id });
  }

  await prisma.$transaction([
    prisma.catalogOrderingDraft.deleteMany({ where: { variantId: { in: variantIds } } }),
    prisma.priceList.deleteMany({ where: { variantId: { in: variantIds } } }),
    prisma.priceOverride.deleteMany({ where: { variantId: { in: variantIds } } }),
    prisma.inventorySnapshot.deleteMany({ where: { productId: existing.id } }),
    prisma.variant.deleteMany({ where: { productId: existing.id } }),
    prisma.product.delete({ where: { id: existing.id } }),
  ]);

  res.json({ success: true, mode: "hard", id: existing.id });
});

router.put("/variants/:id/status", async (req: AdminRequest, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status", details: parsed.error.flatten() });

  const existing = await prisma.variant.findUnique({
    where: { id: req.params.id },
    include: { product: true },
  });
  if (!existing) return res.status(404).json({ error: "variant_not_found" });

  const updatedVariant = await prisma.variant.update({
    where: { id: existing.id },
    data: { catalogStatus: parsed.data.status },
  });

  if (parsed.data.status === "active" && existing.product.catalogStatus === "inactive") {
    await prisma.product.update({
      where: { id: existing.productId },
      data: { catalogStatus: "active" },
    });
  }

  res.json({ success: true, variant: updatedVariant });
});

router.delete("/variants/:id", async (req: AdminRequest, res) => {
  const existing = await prisma.variant.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) return res.status(404).json({ error: "variant_not_found" });

  const [orderItemsCount, intentItemsCount] = await Promise.all([
    prisma.orderItem.count({ where: { variantId: existing.id } }),
    prisma.retailerProposalOrderIntentItem.count({ where: { variantId: existing.id } }),
  ]);

  if (orderItemsCount > 0 || intentItemsCount > 0) {
    await prisma.variant.update({
      where: { id: existing.id },
      data: { catalogStatus: "archived" },
    });
  } else {
    await prisma.$transaction([
      prisma.catalogOrderingDraft.deleteMany({ where: { variantId: existing.id } }),
      prisma.priceList.deleteMany({ where: { variantId: existing.id } }),
      prisma.priceOverride.deleteMany({ where: { variantId: existing.id } }),
      prisma.inventorySnapshot.deleteMany({ where: { variantId: existing.id } }),
      prisma.variant.delete({ where: { id: existing.id } }),
    ]);
  }

  const remainingVariantsCount = await prisma.variant.count({
    where: {
      productId: existing.productId,
      catalogStatus: { notIn: ["archived", "deleted"] },
    },
  });

  if (remainingVariantsCount === 0) {
    const productOrdersCount = await prisma.orderItem.count({
      where: { variant: { productId: existing.productId } },
    });
    if (productOrdersCount > 0) {
      await prisma.product.update({
        where: { id: existing.productId },
        data: { catalogStatus: "archived" },
      });
    } else {
      await prisma.inventorySnapshot.deleteMany({ where: { productId: existing.productId } });
      await prisma.product.delete({ where: { id: existing.productId } }).catch(() => {});
    }
  }

  res.json({ success: true, id: existing.id });
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
