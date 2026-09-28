import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { validateDraftPack } from "./draftPack";
import { deriveCataloguePublicationInput, type BusinessCataloguePublicationInput } from "./draftCataloguePublication";
import { productCatalogueIdentity, semanticPackMatches, variantCatalogueIdentity } from "./catalogueIdentity";
import { resolveTierPrice } from "./cataloguePricing";
import { internalStagingInventoryEnabled, upsertInventorySnapshot, DEFAULT_WAREHOUSE_CODE } from "../inventory/inventoryService";

type Db = Prisma.TransactionClient | typeof prisma;

export class CatalogueSkuError extends Error {
  constructor(readonly code: string, readonly status = 400) {
    super(code);
  }
}

export type CatalogueSkuTierInput = { tierId: string; price?: number | null; discountPercent?: number | null };
export type CatalogueSkuInput = {
  productName: string;
  brandName: string;
  groupName: string;
  category: string;
  imageUrl?: string | null;
  packSize: string;
  unit: string;
  unitsPerCase: number;
  measuredWeightKg?: number | null;
  outerPack: "Bag" | "Box";
  purchaseRate: number;
  purchaseRateBasis: "case" | "quintal";
  listRate: number;
  sellingRateBasis: "case" | "quintal";
  tiers: CatalogueSkuTierInput[];
  gstPercent: number;
  routingClass: "LAXMI_TOOR" | "INSTANT_MIX" | "OTHER";
  routingBagEquivalent?: number | null;
  openingStockCases?: number | null;
  warehouseCode?: string;
  active: boolean;
  productId?: string | null;
  variantId?: string | null;
};

const MASS: Record<string, number> = { kg: 1, g: 0.001, quintal: 100 };
const UNIT: Record<string, string> = { kg: "kg", kgs: "kg", g: "g", gm: "g", grams: "g", quintal: "quintal", qtl: "quintal", pcs: "pcs", pc: "pcs", piece: "pcs", pieces: "pcs" };

function packFrom(input: CatalogueSkuInput) {
  const unit = UNIT[input.unit.trim().toLowerCase()];
  const size = Number(input.packSize);
  if (!unit || !Number.isFinite(size) || size <= 0) throw new CatalogueSkuError("invalid_pack");
  const unitWeightKg = unit === "pcs" ? Number(input.measuredWeightKg) : Math.round(size * MASS[unit] * 1000) / 1000;
  const pack = { unitSize: `${size} ${unit}`, unit, unitsPerCase: input.unitsPerCase, unitWeightKg };
  const validated = validateDraftPack(pack);
  if (validated.errors.length) throw new CatalogueSkuError("invalid_pack");
  return pack;
}

function imageState(imageUrl: string | null | undefined) {
  const url = imageUrl?.trim() || null;
  if (url) return { imageUrl: url, catalogImageStatus: "exact", catalogImageLabel: null };
  return { imageUrl: null, catalogImageStatus: "placeholder", catalogImageLabel: "Image coming soon" };
}

function routing(input: CatalogueSkuInput) {
  if (input.routingClass === "OTHER" && !(Number(input.routingBagEquivalent) > 0)) throw new CatalogueSkuError("routing_bag_equivalent_required");
  if (input.routingClass !== "OTHER" && input.routingBagEquivalent != null) throw new CatalogueSkuError("routing_bag_equivalent_not_allowed");
  return { routingClass: input.routingClass, routingBagEquivalent: input.routingClass === "OTHER" ? input.routingBagEquivalent : null, sellingEntity: null };
}

async function tierPrices(tx: Prisma.TransactionClient, input: CatalogueSkuInput) {
  const tiers = await tx.tier.findMany({ orderBy: { name: "asc" } });
  if (!tiers.length) throw new CatalogueSkuError("tiers_not_configured");
  const supplied = new Map(input.tiers.map((tier) => [tier.tierId, tier]));
  if (supplied.size !== input.tiers.length || tiers.some((tier) => !supplied.has(tier.id))) throw new CatalogueSkuError("tier_prices_required");
  return tiers.map((tier) => {
    const row = supplied.get(tier.id)!;
    const resolved = resolveTierPrice(input.listRate, row.price, row.discountPercent);
    if (!resolved.ok) throw new CatalogueSkuError(resolved.code);
    if (!(resolved.price >= 0)) throw new CatalogueSkuError("tier_price_required");
    return { tierId: tier.id, price: resolved.price };
  });
}

async function writeStock(tx: Prisma.TransactionClient, product: { id: string; sapMaterialId: string | null }, variant: { id: string; internalCode: string | null }, cases: number | null | undefined, warehouseCode: string) {
  if (cases == null) return;
  if (!Number.isFinite(cases) || cases < 0) throw new CatalogueSkuError("invalid_opening_stock");
  if (product.sapMaterialId) throw new CatalogueSkuError("manual_stock_cannot_override_sap");
  if (!internalStagingInventoryEnabled()) throw new CatalogueSkuError("manual_stock_requires_staging_inventory");
  if (!variant.internalCode) throw new CatalogueSkuError("manual_stock_requires_internal_identity");
  const existing = await tx.inventorySnapshot.findUnique({ where: { internalMaterialId_warehouseCode: { internalMaterialId: variant.internalCode, warehouseCode } } });
  await upsertInventorySnapshot(tx, {
    productId: product.id,
    variantId: variant.id,
    internalMaterialId: variant.internalCode,
    warehouseCode,
    onHand: cases + (existing ? Number(existing.committed) : 0),
    committed: existing ? Number(existing.committed) : 0,
    source: "staging_uat",
  });
}

async function saveIn(tx: Prisma.TransactionClient, input: CatalogueSkuInput, actorStaffId: string) {
  if (!(input.purchaseRate >= 0) || !(input.listRate > 0) || !(input.gstPercent >= 0)) throw new CatalogueSkuError("commercial_fields_required");
  const pack = packFrom(input);
  const business: BusinessCataloguePublicationInput = {
    product: { name: input.productName.trim(), brandName: input.brandName.trim(), groupName: input.groupName.trim(), category: input.category.trim(), ...(input.imageUrl?.trim() ? { imageUrl: input.imageUrl.trim() } : {}) },
    pack: { ...pack, outerPack: input.outerPack },
  };
  const semantic = deriveCataloguePublicationInput(business);
  if (!semanticPackMatches(semantic, { unitWeightKg: pack.unitWeightKg, unitsPerCase: pack.unitsPerCase })) throw new CatalogueSkuError("catalogue_semantics_pack_mismatch");
  const productIdentity = productCatalogueIdentity(semantic);
  const variantIdentity = variantCatalogueIdentity(semantic);
  const prices = await tierPrices(tx, input);
  const route = routing(input);
  const image = imageState(input.imageUrl);
  const status = input.active ? "active" : "inactive";
  const warehouseCode = input.warehouseCode?.trim() || DEFAULT_WAREHOUSE_CODE;
  const commercial = {
    purchaseRate: input.purchaseRate,
    purchaseRateBasis: input.purchaseRateBasis,
    listRate: input.listRate,
    listRateBasis: input.sellingRateBasis,
    gstPercent: input.gstPercent,
    ...route,
    ...image,
    catalogStatus: status,
  };

  if (input.variantId) {
    const variant = await tx.variant.findUnique({ where: { id: input.variantId }, include: { product: true, orderItems: { select: { id: true }, take: 1 } } });
    if (!variant) throw new CatalogueSkuError("pack_not_found", 404);
    const identityLocked = Boolean(variant.catalogKey || variant.orderItems.length);
    if (identityLocked && (variant.unitSize.toLowerCase() !== pack.unitSize.toLowerCase() || variant.unitsPerCase !== pack.unitsPerCase || variant.product.name !== business.product.name || variant.product.catalogIdentityBrand !== productIdentity.brand || variant.product.catalogIdentityGroup !== productIdentity.group || (variant.catalogIdentityMasterPack != null && variant.catalogIdentityMasterPack !== variantIdentity.master))) {
      throw new CatalogueSkuError("identity_fields_locked", 409);
    }
    const product = await tx.product.update({
      where: { id: variant.productId },
      data: {
        ...(identityLocked ? {} : { name: business.product.name, category: business.product.category, catalogIdentityBrand: productIdentity.brand, catalogIdentityGroup: productIdentity.group, catalogIdentityLabel: productIdentity.label }),
        ...(image.imageUrl ? { imageUrl: image.imageUrl } : {}),
        ...(status === "active" && variant.product.catalogStatus !== "published" ? { catalogStatus: "active" } : {}),
      },
    });
    const saved = await tx.variant.update({ where: { id: variant.id }, data: { ...(identityLocked ? {} : pack), ...commercial } });
    for (const price of prices) {
      await tx.priceList.upsert({
        where: { tierId_variantId: { tierId: price.tierId, variantId: saved.id } },
        update: { price: price.price, rateBasis: input.sellingRateBasis },
        create: { tierId: price.tierId, variantId: saved.id, productId: product.id, price: price.price, rateBasis: input.sellingRateBasis },
      });
    }
    if (input.openingStockCases != null) await writeStock(tx, product, saved, input.openingStockCases, warehouseCode);
    await tx.auditEvent.create({ data: { actorStaffId, action: "catalog.sku_saved", subjectType: "variant", subjectId: saved.id, metadata: { productId: product.id, variantId: saved.id, active: input.active, mode: "edit" } } });
    return { productId: product.id, variantId: saved.id, catalogStatus: saved.catalogStatus };
  }

  const existingProduct = input.productId ? await tx.product.findUnique({ where: { id: input.productId } }) : null;
  if (input.productId && !existingProduct) throw new CatalogueSkuError("product_not_found", 404);
  if (existingProduct?.catalogKey && existingProduct.catalogKey !== productIdentity.catalogKey) throw new CatalogueSkuError("catalogue_identity_mismatch", 409);
  const taken = await tx.variant.findUnique({ where: { catalogKey: variantIdentity.catalogKey } });
  if (taken) throw new CatalogueSkuError("canonical_pack_exists", 409);
  const productOwner = await tx.product.findUnique({ where: { catalogKey: productIdentity.catalogKey } });
  if (productOwner && productOwner.id !== existingProduct?.id) throw new CatalogueSkuError("canonical_product_exists", 409);

  const product = existingProduct
    ? await tx.product.update({
        where: { id: existingProduct.id },
        data: {
          ...(existingProduct.catalogKey ? {} : { catalogKey: productIdentity.catalogKey, internalCode: productIdentity.internalCode, catalogIdentityBrand: productIdentity.brand, catalogIdentityGroup: productIdentity.group, catalogIdentityLabel: productIdentity.label }),
          ...(status === "active" && !["active", "published"].includes(existingProduct.catalogStatus) ? { catalogStatus: "active" } : {}),
        },
      })
    : await tx.product.create({
        data: {
          name: business.product.name,
          category: business.product.category,
          imageUrl: image.imageUrl,
          catalogStatus: status,
          catalogKey: productIdentity.catalogKey,
          internalCode: productIdentity.internalCode,
          catalogIdentityBrand: productIdentity.brand,
          catalogIdentityGroup: productIdentity.group,
          catalogIdentityLabel: productIdentity.label,
        },
      });
  const variant = await tx.variant.create({
    data: {
      productId: product.id,
      ...pack,
      ...commercial,
      catalogKey: variantIdentity.catalogKey,
      internalCode: variantIdentity.internalCode,
      catalogIdentitySkuName: variantIdentity.skuName,
      catalogIdentityPackingSize: variantIdentity.packingSize,
      catalogIdentityMasterPack: variantIdentity.master,
    },
  });
  for (const price of prices) {
    await tx.priceList.create({ data: { tierId: price.tierId, variantId: variant.id, productId: product.id, price: price.price, rateBasis: input.sellingRateBasis } });
  }
  await writeStock(tx, product, variant, input.openingStockCases ?? 0, warehouseCode);
  await tx.auditEvent.create({ data: { actorStaffId, action: "catalog.sku_saved", subjectType: "variant", subjectId: variant.id, metadata: { productId: product.id, variantId: variant.id, active: input.active, mode: existingProduct ? "add_pack" : "create" } } });
  return { productId: product.id, variantId: variant.id, catalogStatus: variant.catalogStatus, productCatalogKey: product.catalogKey, variantCatalogKey: variant.catalogKey };
}

export async function saveCatalogueSku(input: CatalogueSkuInput, actorStaffId: string, db: Db = prisma) {
  if (db === prisma) return prisma.$transaction((tx) => saveIn(tx, input, actorStaffId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return saveIn(db, input, actorStaffId);
}
