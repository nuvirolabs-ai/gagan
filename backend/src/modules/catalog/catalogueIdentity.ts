import crypto from "node:crypto";

const MASS_TO_KG: Record<string, number> = {
  KG: 1,
  KGS: 1,
  G: 0.001,
  GM: 0.001,
  GRAMS: 0.001,
  QUINTAL: 100,
  QTL: 100,
};

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/** Comparison normalization only. This never changes the stored source text. */
export function normalizeCatalogueText(value: unknown) {
  return clean(value)
    .toUpperCase()
    .replace(/(\d)\s+(KG|KGS|GM|G)\b/g, "$1$2");
}

export function catalogueDigest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export type ProductSemanticInput = {
  brandName: string;
  groupName: string;
  productLabel: string;
};

export type VariantSemanticInput = {
  brandName: string;
  groupName: string;
  skuName: string;
  packingSize: string;
  masterBagBoxSize: string;
};

export function productCatalogueIdentity(input: ProductSemanticInput) {
  const brand = normalizeCatalogueText(input.brandName);
  const group = normalizeCatalogueText(input.groupName);
  const label = normalizeCatalogueText(input.productLabel);
  const digest = catalogueDigest([brand, group, label].join("|"));
  return {
    catalogKey: `real-catalogue:product:${digest}`,
    internalCode: `GAGAN-INT-P-${digest}`,
    brand,
    group,
    label,
  };
}

export function variantCatalogueIdentity(input: VariantSemanticInput) {
  const brand = normalizeCatalogueText(input.brandName);
  const group = normalizeCatalogueText(input.groupName);
  const skuName = normalizeCatalogueText(input.skuName);
  const packingSize = normalizeCatalogueText(input.packingSize);
  const master = normalizeCatalogueText(input.masterBagBoxSize);
  const digest = catalogueDigest([brand, group, skuName, packingSize, master].join("|"));
  return {
    catalogKey: `real-catalogue:variant:${digest}`,
    internalCode: `GAGAN-INT-V-${digest}`,
    brand,
    group,
    skuName,
    packingSize,
    master,
  };
}

export function validProductCatalogueIdentity(catalogKey: string | null | undefined, internalCode: string | null | undefined) {
  const match = /^real-catalogue:product:([a-f0-9]{64})$/.exec(catalogKey ?? "");
  return Boolean(match && internalCode === `GAGAN-INT-P-${match[1]}`);
}

export function validVariantCatalogueIdentity(catalogKey: string | null | undefined, internalCode: string | null | undefined) {
  const match = /^real-catalogue:variant:([a-f0-9]{64})$/.exec(catalogKey ?? "");
  return Boolean(match && internalCode === `GAGAN-INT-V-${match[1]}`);
}

function parseMassKg(text: string) {
  const match = normalizeCatalogueText(text).match(/^([0-9]+(?:\.[0-9]+)?)(KG|KGS|GM|G|GRAMS|QUINTAL|QTL)$/);
  if (!match) return null;
  const weight = Number(match[1]) * MASS_TO_KG[match[2]];
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

function parseMasterKg(text: string) {
  const match = normalizeCatalogueText(text).match(/^([0-9]+(?:\.[0-9]+)?)(KG|KGS|GM|G|GRAMS|QUINTAL|QTL)\s*(BAG|BOX)$/);
  if (!match) return null;
  const weight = Number(match[1]) * MASS_TO_KG[match[2]];
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

function close(left: number, right: number) {
  return Math.abs(left - right) <= 1e-9;
}

export function semanticPackMatches(
  semantic: { skuName: string; packingSize: string; masterBagBoxSize: string },
  pack: { unitWeightKg: number; unitsPerCase: number },
) {
  const packingKg = parseMassKg(semantic.packingSize);
  const masterKg = parseMasterKg(semantic.masterBagBoxSize);
  const caseWeightKg = pack.unitWeightKg * pack.unitsPerCase;
  if (packingKg == null || masterKg == null || !close(packingKg, pack.unitWeightKg) || !close(masterKg, caseWeightKg)) return false;
  const sku = clean(semantic.skuName).match(/^(.*?)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|gm|g|grams|quintal|qtl)\s*[x×*]\s*([0-9]+(?:\.[0-9]+)?)\s*\)$/i);
  if (!sku) return true;
  const units = Number(sku[4]);
  const weight = Number(sku[2]) * MASS_TO_KG[sku[3].toUpperCase()];
  return Number.isSafeInteger(units) && units > 0 && close(weight, pack.unitWeightKg) && units === pack.unitsPerCase;
}
