import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  normalizeCatalogueText,
  productCatalogueIdentity,
  semanticPackMatches,
  validProductCatalogueIdentity,
  validVariantCatalogueIdentity,
  variantCatalogueIdentity,
  type ProductSemanticInput,
  type VariantSemanticInput,
} from "./catalogueIdentity";

export class CataloguePublicationError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super(code);
  }
}

export type CataloguePublicationInput = Partial<ProductSemanticInput & VariantSemanticInput>;
export type BusinessCataloguePublicationInput = {
  product: {
    name: string;
    brandName: string;
    groupName: string;
    category: string;
    imageUrl?: string;
    description?: string;
  };
  pack: {
    unitSize: string;
    unit: string;
    unitsPerCase: number;
    unitWeightKg: number;
    outerPack: "Bag" | "Box";
  };
};

type Loaded = Prisma.VariantGetPayload<{ include: { product: true } }>;

function complete(input: CataloguePublicationInput): input is ProductSemanticInput & VariantSemanticInput {
  return Boolean(input.brandName?.trim() && input.groupName?.trim() && input.productLabel?.trim() && input.skuName?.trim() && input.packingSize?.trim() && input.masterBagBoxSize?.trim());
}

function sameSellablePack(left: { unitSize: string; unit: string; unitsPerCase: number; unitWeightKg: Prisma.Decimal | number }, right: { unitSize: string; unit: string; unitsPerCase: number; unitWeightKg: Prisma.Decimal | number }) {
  return normalizeCatalogueText(left.unitSize) === normalizeCatalogueText(right.unitSize)
    && normalizeCatalogueText(left.unit) === normalizeCatalogueText(right.unit)
    && left.unitsPerCase === right.unitsPerCase
    && Math.abs(Number(left.unitWeightKg) - Number(right.unitWeightKg)) <= 1e-9;
}

function displayPackSize(unitSize: string) {
  return cleanUnitSize(unitSize).replace(/\s+/g, " ");
}

function cleanUnitSize(value: string) {
  return String(value).trim();
}

function formatCaseWeightKg(unitWeightKg: number, unitsPerCase: number) {
  const weight = Math.round(unitWeightKg * unitsPerCase * 1000) / 1000;
  return String(Number(weight.toFixed(3)));
}

function stripBrandPrefix(productName: string, brandName: string) {
  const cleanName = productName.trim().replace(/\s+/g, " ");
  const cleanBrand = brandName.trim().replace(/\s+/g, " ");
  if (!cleanBrand) return cleanName;
  const match = new RegExp(`^${cleanBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  return cleanName.replace(match, "").trim() || cleanName;
}

export function deriveCataloguePublicationInput(input: BusinessCataloguePublicationInput): ProductSemanticInput & VariantSemanticInput {
  const productName = input.product.name.trim();
  const brandName = input.product.brandName.trim();
  const groupName = input.product.groupName.trim();
  const productLabel = stripBrandPrefix(productName, brandName);
  const packingSize = displayPackSize(input.pack.unitSize);
  return {
    brandName,
    groupName,
    productLabel,
    skuName: `${productLabel} (${packingSize} x ${input.pack.unitsPerCase})`,
    packingSize,
    masterBagBoxSize: `${formatCaseWeightKg(input.pack.unitWeightKg, input.pack.unitsPerCase)}KG ${input.pack.outerPack}`,
  };
}

async function recordBlock(
  tx: Prisma.TransactionClient,
  actorStaffId: string,
  variant: Loaded,
  duplicateDecision: string,
  current?: { productId: string; variantId: string },
) {
  await tx.auditEvent.create({
    data: {
      actorStaffId,
      action: "catalog.catalogue_publication_blocked",
      subjectType: "variant",
      subjectId: variant.id,
      metadata: { productId: variant.productId, variantId: variant.id, duplicateDecision, current: current ?? null },
    },
  });
}

function present(variant: Loaded, duplicateDecision: "assigned" | "already_published") {
  return {
    outcome: "published" as const,
    duplicateDecision,
    product: {
      id: variant.product.id,
      catalogStatus: variant.product.catalogStatus,
      catalogKey: variant.product.catalogKey,
      internalCode: variant.product.internalCode,
      catalogIdentityBrand: variant.product.catalogIdentityBrand,
      catalogIdentityGroup: variant.product.catalogIdentityGroup,
      catalogIdentityLabel: variant.product.catalogIdentityLabel,
    },
    variant: {
      id: variant.id,
      catalogStatus: variant.catalogStatus,
      catalogKey: variant.catalogKey,
      internalCode: variant.internalCode,
      catalogIdentitySkuName: variant.catalogIdentitySkuName,
      catalogIdentityPackingSize: variant.catalogIdentityPackingSize,
      catalogIdentityMasterPack: variant.catalogIdentityMasterPack,
      unitSize: variant.unitSize,
      unit: variant.unit,
      unitsPerCase: variant.unitsPerCase,
      unitWeightKg: Number(variant.unitWeightKg),
    },
  };
}

export async function publishDraftCatalogue(variantId: string, input: CataloguePublicationInput, actorStaffId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Variant" WHERE id = ${variantId} FOR UPDATE`;
    const variant = await tx.variant.findUnique({ where: { id: variantId }, include: { product: true } });
    if (!variant) throw new CataloguePublicationError("pack_not_found", 404);
    const product = variant.product;
    const alreadyLive = variant.catalogStatus === "published" || variant.catalogStatus === "active";
    const validIdentity = validVariantCatalogueIdentity(variant.catalogKey, variant.internalCode)
      && validProductCatalogueIdentity(product.catalogKey, product.internalCode);

    if (alreadyLive && validIdentity && !complete(input)) return present(variant, "already_published");
    if (alreadyLive && validIdentity && complete(input)) {
      const derivedVariant = variantCatalogueIdentity(input);
      const derivedProduct = productCatalogueIdentity(input);
      if (derivedVariant.catalogKey === variant.catalogKey && derivedProduct.catalogKey === product.catalogKey) return present(variant, "already_published");
      await recordBlock(tx, actorStaffId, variant, "catalogue_identity_mismatch");
      return { outcome: "blocked" as const, code: "catalogue_identity_mismatch", productId: product.id, variantId: variant.id };
    }
    if (variant.catalogStatus !== "pending_review") throw new CataloguePublicationError("invalid_lifecycle");
    if (!["pending_review", "published", "active"].includes(product.catalogStatus)) throw new CataloguePublicationError("invalid_lifecycle");
    if (!complete(input)) throw new CataloguePublicationError("semantic_identity_required", 400);
    if (!semanticPackMatches(input, { unitWeightKg: Number(variant.unitWeightKg), unitsPerCase: variant.unitsPerCase })) {
      throw new CataloguePublicationError("catalogue_semantics_pack_mismatch", 400);
    }

    const productIdentity = productCatalogueIdentity(input);
    const variantIdentity = variantCatalogueIdentity(input);
    if ((product.catalogKey && product.catalogKey !== productIdentity.catalogKey) || (product.internalCode && product.internalCode !== productIdentity.internalCode)) {
      await recordBlock(tx, actorStaffId, variant, "catalogue_identity_mismatch");
      return { outcome: "blocked" as const, code: "catalogue_identity_mismatch", productId: product.id, variantId: variant.id };
    }
    if (product.catalogIdentityBrand && (product.catalogIdentityBrand !== productIdentity.brand || product.catalogIdentityGroup !== productIdentity.group || product.catalogIdentityLabel !== productIdentity.label)) {
      await recordBlock(tx, actorStaffId, variant, "catalogue_identity_mismatch");
      return { outcome: "blocked" as const, code: "catalogue_identity_mismatch", productId: product.id, variantId: variant.id };
    }
    if ((variant.catalogKey && variant.catalogKey !== variantIdentity.catalogKey) || (variant.internalCode && variant.internalCode !== variantIdentity.internalCode)) {
      await recordBlock(tx, actorStaffId, variant, "catalogue_identity_mismatch");
      return { outcome: "blocked" as const, code: "catalogue_identity_mismatch", productId: product.id, variantId: variant.id };
    }

    const [productByKey, variantByKey, canonicalPacks, unnamedProducts] = await Promise.all([
      tx.product.findUnique({ where: { catalogKey: productIdentity.catalogKey } }),
      tx.variant.findUnique({ where: { catalogKey: variantIdentity.catalogKey } }),
      tx.variant.findMany({ where: { productId: product.id, id: { not: variant.id }, catalogKey: { not: null } } }),
      tx.product.findMany({ where: { id: { not: product.id }, catalogKey: null }, include: { variants: true } }),
    ]);

    if (variantByKey && variantByKey.id !== variant.id) {
      await recordBlock(tx, actorStaffId, variant, "canonical_pack_exists", { productId: variantByKey.productId, variantId: variantByKey.id });
      return { outcome: "blocked" as const, code: "canonical_pack_exists", productId: variantByKey.productId, variantId: variantByKey.id };
    }
    if (productByKey && productByKey.id !== product.id) {
      await recordBlock(tx, actorStaffId, variant, "canonical_product_exists", { productId: productByKey.id, variantId: variant.id });
      return { outcome: "blocked" as const, code: "canonical_product_exists", productId: productByKey.id, variantId: variant.id };
    }
    const conflictingPack = canonicalPacks.find((candidate) => sameSellablePack(variant, candidate) && candidate.catalogKey !== variantIdentity.catalogKey);
    const legacyLookalike = unnamedProducts.some((candidate) => normalizeCatalogueText(candidate.name) === normalizeCatalogueText(product.name) && candidate.variants.some((pack) => sameSellablePack(variant, pack)));
    if (conflictingPack || legacyLookalike) {
      await recordBlock(tx, actorStaffId, variant, "catalogue_publication_ambiguous");
      return { outcome: "blocked" as const, code: "catalogue_publication_ambiguous", productId: product.id, variantId: variant.id };
    }

    const before = {
      productStatus: product.catalogStatus,
      variantStatus: variant.catalogStatus,
      productCatalogKey: product.catalogKey,
      productInternalCode: product.internalCode,
      variantCatalogKey: variant.catalogKey,
      variantInternalCode: variant.internalCode,
    };
    const nextProductStatus = product.catalogStatus === "pending_review" ? "published" : product.catalogStatus;
    await tx.product.update({
      where: { id: product.id },
      data: {
        catalogStatus: nextProductStatus,
        ...(product.catalogKey ? {} : { catalogKey: productIdentity.catalogKey, internalCode: productIdentity.internalCode }),
        ...(product.catalogIdentityBrand ? {} : {
          catalogIdentityBrand: productIdentity.brand,
          catalogIdentityGroup: productIdentity.group,
          catalogIdentityLabel: productIdentity.label,
        }),
      },
    });
    await tx.variant.update({
      where: { id: variant.id },
      data: {
        catalogStatus: "published",
        ...(variant.catalogKey ? {} : { catalogKey: variantIdentity.catalogKey, internalCode: variantIdentity.internalCode }),
        catalogIdentitySkuName: variantIdentity.skuName,
        catalogIdentityPackingSize: variantIdentity.packingSize,
        catalogIdentityMasterPack: variantIdentity.master,
      },
    });
    const saved = await tx.variant.findUniqueOrThrow({ where: { id: variant.id }, include: { product: true } });
    await tx.auditEvent.create({
      data: {
        actorStaffId,
        action: "catalog.catalogue_published",
        subjectType: "variant",
        subjectId: variant.id,
        metadata: {
          productId: product.id,
          variantId: variant.id,
          before,
          after: {
            productStatus: saved.product.catalogStatus,
            variantStatus: saved.catalogStatus,
            productCatalogKey: saved.product.catalogKey,
            productInternalCode: saved.product.internalCode,
            variantCatalogKey: saved.catalogKey,
            variantInternalCode: saved.internalCode,
          },
          duplicateDecision: "assigned",
        },
      },
    });
    return present(saved, "assigned");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function publishDraftCatalogueFromBusinessInput(input: BusinessCataloguePublicationInput, actorStaffId: string) {
  const productName = input.product.name.trim();
  const brandName = input.product.brandName.trim();
  const groupName = input.product.groupName.trim();
  const category = input.product.category.trim();
  if (!productName || !brandName || !groupName || !category) throw new CataloguePublicationError("invalid_product", 400);
  if (!["Bag", "Box"].includes(input.pack.outerPack)) throw new CataloguePublicationError("invalid_outer_pack", 400);
  const semantic = deriveCataloguePublicationInput(input);
  const existing = await prisma.product.findMany({ where: { name: { equals: productName, mode: "insensitive" } }, select: { id: true } });
  if (existing.length) throw new CataloguePublicationError("product_name_exists", 409);
  const productIdentity = productCatalogueIdentity(semantic);
  const variantIdentity = variantCatalogueIdentity(semantic);
  const [productByKey, variantByKey] = await Promise.all([
    prisma.product.findUnique({ where: { catalogKey: productIdentity.catalogKey }, select: { id: true } }),
    prisma.variant.findUnique({ where: { catalogKey: variantIdentity.catalogKey }, select: { id: true, productId: true } }),
  ]);
  if (variantByKey) return { outcome: "blocked" as const, code: "canonical_pack_exists", productId: variantByKey.productId, variantId: variantByKey.id };
  if (productByKey) return { outcome: "blocked" as const, code: "canonical_product_exists", productId: productByKey.id, variantId: "" };
  const product = await prisma.product.create({
    data: {
      name: productName,
      category,
      catalogStatus: "pending_review",
      imageUrl: input.product.imageUrl,
      description: input.product.description,
      catalogIdentityBrand: productIdentity.brand,
      catalogIdentityGroup: productIdentity.group,
      catalogIdentityLabel: productIdentity.label,
      variants: {
        create: [{
          unitSize: input.pack.unitSize,
          unit: input.pack.unit,
          unitsPerCase: input.pack.unitsPerCase,
          unitWeightKg: input.pack.unitWeightKg,
          catalogStatus: "pending_review",
          catalogImageStatus: "pending",
          catalogImageLabel: "Image pending confirmation",
        }],
      },
    },
    include: { variants: true },
  });
  return publishDraftCatalogue(product.variants[0].id, semantic, actorStaffId);
}

export async function publishExistingDraftCatalogueFromBusinessInput(variantId: string, outerPack: "Bag" | "Box", actorStaffId: string) {
  const variant = await prisma.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant) throw new CataloguePublicationError("pack_not_found", 404);
  const brandName = variant.product.catalogIdentityBrand ?? "";
  const groupName = variant.product.catalogIdentityGroup ?? "";
  const productLabel = variant.product.catalogIdentityLabel ?? "";
  if (!brandName || !groupName || !productLabel) throw new CataloguePublicationError("semantic_identity_required", 400);
  const packingSize = displayPackSize(variant.unitSize);
  const semantic = {
    brandName,
    groupName,
    productLabel,
    skuName: `${productLabel} (${packingSize} x ${variant.unitsPerCase})`,
    packingSize,
    masterBagBoxSize: `${formatCaseWeightKg(Number(variant.unitWeightKg), variant.unitsPerCase)}KG ${outerPack}`,
  };
  return publishDraftCatalogue(variantId, semantic, actorStaffId);
}
