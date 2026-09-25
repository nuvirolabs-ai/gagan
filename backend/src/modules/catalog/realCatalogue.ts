import crypto from "node:crypto";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { Prisma, type PrismaClient } from "@prisma/client";
import { internalStagingInventoryEnabled } from "../inventory/inventoryService";

export const REAL_CATALOGUE_VERSION = "sku-wise-item-list-2026-09-16-v1";
export const REAL_CATALOGUE_SOURCE_FILE = "SKU WISE ITEM LIST – 16-09-26-UPDATED.xlsx";
export const REAL_CATALOGUE_STATUSES = ["active", "published", "pending_review", "archived", "test"] as const;
export type RealCatalogueStatus = (typeof REAL_CATALOGUE_STATUSES)[number];

export type DriveImageEntry = {
  folder: string;
  folderId: string;
  fileName: string;
  driveFileId: string;
};

export type RealCatalogueImage = {
  status: "matched" | "ambiguous" | "missing" | "placeholder";
  candidates: DriveImageEntry[];
  selectedDriveFileId?: string | null;
  /** Root-relative path served by the existing private application asset. */
  assetPath: string | null;
  /** Human-readable state when a photo is intentionally not exact imagery. */
  placeholderLabel?: "Image coming soon" | "Image pending confirmation";
};

export type RealCataloguePriceDecision = {
  tierId: string;
  rate: string;
  rateBasis: "case" | "quintal";
  /** The current commercial engine expects rates before GST. */
  gstIncluded: boolean;
};

export type RealCatalogueInventoryDecision = {
  /** Exactly one identity is allowed. Internal IDs are staging-only and are
   * never copied into Product.sapMaterialId or an SAP payload. */
  sapMaterialId?: string;
  internalMaterialId?: string;
  warehouseCode: string;
  evidence: string;
};

export type RealCatalogueDecisionRecord = {
  /** The source-manifest key is immutable and is the approval lookup key. */
  variantKey: string;
  productCatalogKey?: string;
  variantCatalogKey?: string;
  productInternalCode?: string;
  variantInternalCode?: string;
  hsnCode?: string;
  gstPercent?: string | number;
  /** Explicit owner-approved staging exception; never means GST is 0%. */
  gstPendingOrderAllowed?: boolean;
  ordering?: {
    unit?: "kg";
    unitsPerCase?: number;
    unitWeightKg?: string | number;
    caseWeightKg?: string | number;
    masterContainer?: "BAG" | "BOX";
  };
  priceLists?: RealCataloguePriceDecision[];
  inventory?: RealCatalogueInventoryDecision;
  routing?: {
    routingClass: "LAXMI_TOOR" | "INSTANT_MIX" | "OTHER";
    routingBagEquivalent?: string | number | null;
    /** Static sellingEntity is allowed only for a legacy, non-routed row. */
    sellingEntity?: "jain_traders" | "padam_international" | null;
  };
  image?: {
    driveFileId?: string;
    placeholderLabel?: "Image coming soon";
    mappingRevision: string;
    evidence?: string;
    sourceFileSha256?: string;
    /** Existing private application asset prepared from the selected source. */
    assetPath?: string;
  };
};

/**
 * Workbook price interpretation is an approval-level fact, not a target
 * price-list selection. Keeping the tier unresolved prevents a GST basis
 * approval from making a row orderable or writing a price to every tier.
 */
export type RealCataloguePricingDecision = {
  sourceRateBasis: "quintal";
  gstTreatment: "exclusive";
  targetTierId: string | null;
  targetTierStatus: "unresolved" | "all_existing_tiers";
  scope?: "all_retailers";
  evidence: string;
};

export type RealCatalogueRetirementCandidate = {
  productId: string;
  expectedName: string;
  expectedSapMaterialId: string | null;
  variantIds: string[];
  reason: string;
};

export type RealCatalogueDecisions = {
  schemaVersion: 1;
  approval: {
    approvalId: string;
    revision: number;
    approvedBy: string;
    approvedAt: string;
    scope: string;
    decisionSource?: string;
    source: {
      workbookSha256: string;
      sourceVersion: string;
      imageIndexSha256?: string;
    };
  };
  pricing?: RealCataloguePricingDecision;
  gstPendingOrdering?: {
    allowOrderBeforeGstFinalized: boolean;
    invoiceBlockedUntilGstConfigured: boolean;
    variantKeys: string[];
    evidence: string;
  };
  imageMappingRevision: string;
  records: RealCatalogueDecisionRecord[];
  retireCandidates?: RealCatalogueRetirementCandidate[];
};

export type RealCatalogueRecord = {
  sourceRows: number[];
  source: {
    typeOfItem: string;
    brandName: string;
    groupName: string;
    itemName: string;
    skuName: string;
    packingSize: string;
    masterBagBoxSize: string;
    pricePerQuintal: string;
  };
  productKey: string;
  variantKey: string;
  /** Approved target identities; source keys remain available for replay. */
  catalogProductKey?: string | null;
  catalogVariantKey?: string | null;
  productInternalCode?: string | null;
  variantInternalCode?: string | null;
  hsnCode?: string | null;
  gstPercent?: string | null;
  gstPendingOrderAllowed?: boolean;
  sellingEntity?: "jain_traders" | "padam_international" | null;
  priceLists?: RealCataloguePriceDecision[];
  inventoryMapping?: RealCatalogueInventoryDecision | null;
  imageMappingRevision?: string | null;
  approvalId?: string | null;
  approvalRevision?: number | null;
  productName: string;
  category: string;
  unitSize: string;
  unit: "kg";
  unitsPerCase: number | null;
  unitWeightKg: string | null;
  caseWeightKg: string | null;
  conversionSource?: "sku_name" | "packing_size_and_master_bag" | "approved_decision" | null;
  pricePerQuintal: string;
  priceBasis: "quintal";
  masterContainer: "BAG" | "BOX" | null;
  routingClass: "LAXMI_TOOR" | "INSTANT_MIX" | "OTHER" | null;
  routingBagEquivalent: string | null;
  image: RealCatalogueImage;
  readinessBlockers: string[];
  catalogStatus: RealCatalogueStatus;
};

export type RealCatalogueManifest = {
  schemaVersion: 1;
  source: {
    fileName: string;
    sha256: string;
    sheet: string;
    headerRow: number;
    dataRows: number;
    uniqueVariantRows: number;
    duplicateSourceRows: number[];
    version: string;
    batchKey: string;
  };
  imageSource: {
    driveFolderUrl: string;
    folderCount: number;
    fileCount: number;
    indexSha256?: string;
  };
  records: RealCatalogueRecord[];
};

export type RealCatalogueApplySummary = {
  sourceSha256: string;
  batchKey: string;
  createdProducts: number;
  updatedProducts: number;
  createdVariants: number;
  updatedVariants: number;
  blockedRows: number;
  skippedRows: number;
  preservedStatuses: number;
  phase?: "import" | "promote" | "publish" | "retire";
  approvalRevision?: number;
  approvalSha256?: string;
  pendingReviewRows?: number;
  retiredProducts?: number;
  retiredVariants?: number;
  placeholderImages?: number;
  pendingImages?: number;
  publishedProducts?: number;
  publishedVariants?: number;
  orderableVariants?: number;
};

type RealCatalogueApprovalMetadata = {
  approvalId: string;
  approvalRevision: number;
  approvalSha256: string;
  imageMappingRevision: string;
  scope: string;
};

export type RealCatalogueTargetIdentity = {
  serviceName: string;
  serviceId: string;
  hostname: string;
  databaseName: string;
  schema: string;
};

const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1JJMyEPQSVtWstUaovGZCFMgpllnTg92e";
export const REAL_CATALOGUE_STAGING_TARGET: RealCatalogueTargetIdentity = {
  serviceName: "gagan-api",
  serviceId: "srv-dak1ppu1egvs7397s9c0",
  hostname: "https://gagan-srat.onrender.com",
  databaseName: "gagan_staging_9ftt",
  schema: "public",
};
const HEADER = [
  "S.NO",
  "TYPE OF ITEM",
  "BRAND NAME",
  "GROUP NAME",
  "ITEM NAME",
  "SKU NAME",
  "PACKING SIZE",
  "MASTER BAG/BOX SIZE",
  "PRICE PER QUINTAL",
] as const;

function clean(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/** Comparison normalization only; this never changes the stored source text. */
function identity(value: unknown) {
  return clean(value)
    .toUpperCase()
    .replace(/(\d)\s+(KG|KGS|GM|G)\b/g, "$1$2");
}

function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
    .replace(/\bG(\d+)\b/gi, "G$1")
    .replace(/\bLpp\b/gi, "LPP");
}

function fileKey(fileName: string) {
  return identity(fileName)
    .replace(/^IMG[_\s]*/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/-\d+$/, "")
    .trim();
}

function categoryFor(typeOfItem: string) {
  const type = identity(typeOfItem);
  if (type === "RICE") return "Rice";
  if (type === "POHA" || type === "SABUDANA" || type === "INSTANT MIX") return "Breakfast";
  return "Daal";
}

function parseSku(skuName: string) {
  const match = clean(skuName).match(
    /^(.*?)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*(KG|KGS|GM|G)\s*[X×*]\s*([0-9]+(?:\.[0-9]+)?)\s*\)$/i,
  );
  if (!match) return null;
  const unitWeightKg = Number(match[2]) * (/^(GM|G)$/i.test(match[3]) ? 0.001 : 1);
  const unitsPerCase = Number(match[4]);
  if (!Number.isFinite(unitWeightKg) || unitWeightKg <= 0 || !Number.isSafeInteger(unitsPerCase) || unitsPerCase <= 0) return null;
  return {
    label: clean(match[1]),
    unitWeightKg: unitWeightKg.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
    unitsPerCase,
    caseWeightKg: (unitWeightKg * unitsPerCase).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""),
  };
}

function parseWeight(value: string) {
  const match = identity(value).match(/^([0-9]+(?:\.[0-9]+)?)\s*(KG|KGS|GM|G)$/);
  if (!match) return null;
  const weightKg = new Prisma.Decimal(match[1]).mul(/^(GM|G)$/.test(match[2]) ? "0.001" : "1");
  if (!weightKg.isFinite() || !weightKg.isPositive()) return null;
  return weightKg;
}

/**
 * A failed SKU-name pattern is not enough to infer a case. The workbook has a
 * narrow, explicit fallback: a 30 KG packing size in a 30KG BAG is one
 * sellable 30 KG bag. Other boxes, mixed packs and unequal master sizes stay
 * unresolved for owner review.
 */
function deriveConversion(source: RealCatalogueRecord["source"]) {
  const fromName = parseSku(source.skuName);
  if (fromName) return { ...fromName, conversionSource: "sku_name" as const };
  const packWeight = parseWeight(source.packingSize);
  const master = parseMaster(source.masterBagBoxSize);
  if (packWeight && master?.container === "BAG" && packWeight.eq(master.weightKg)) {
    return {
      label: clean(source.skuName),
      unitWeightKg: packWeight.toString(),
      unitsPerCase: 1,
      caseWeightKg: packWeight.toString(),
      conversionSource: "packing_size_and_master_bag" as const,
    };
  }
  return null;
}

function parseMaster(master: string) {
  const match = identity(master).match(/^([0-9]+(?:\.[0-9]+)?)\s*(KG|KGS)\s*(BAG|BOX)$/);
  if (!match) return null;
  return { weightKg: match[1], container: match[3] as "BAG" | "BOX" };
}

function displayProductName(brand: string, label: string) {
  const humanBrand = titleCase(brand);
  const humanLabel = titleCase(label);
  return identity(humanLabel).startsWith(identity(brand)) ? humanLabel : `${humanBrand} ${humanLabel}`;
}

function decimalText(value: string | number, field: string, options: { positive?: boolean; maxPlaces?: number } = {}) {
  const text = clean(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`invalid_decision_${field}`);
  const result = new Prisma.Decimal(text);
  if (!result.isFinite() || (options.positive && !result.isPositive())) throw new Error(`invalid_decision_${field}`);
  if (options.maxPlaces !== undefined && result.decimalPlaces() > options.maxPlaces) throw new Error(`invalid_decision_${field}_precision`);
  return result.toString();
}

function readinessBlockersFor(record: RealCatalogueRecord, options: { allExistingTiersApproved?: boolean } = {}) {
  const blockers: string[] = [];
  if (!record.productInternalCode || !record.variantInternalCode) blockers.push("stable_internal_catalogue_identity_requires_approval");
  // The owner-approved six-variant staging exception allows an order quote
  // before GST is finalized, but it never makes the row invoiceable. The
  // resolved record carries the explicit per-variant grant; absent that grant
  // a missing GST value remains a readiness blocker.
  if ((record.gstPercent === null || record.gstPercent === undefined) && record.gstPendingOrderAllowed !== true) blockers.push("gst_percent_requires_approval");
  if (!record.inventoryMapping) blockers.push("inventory_mapping_requires_approval");
  if (!record.priceLists?.length && options.allExistingTiersApproved !== true) blockers.push("price_tier_requires_approval");
  if (record.priceLists?.some((price) => price.gstIncluded)) blockers.push("price_gst_basis_incompatible_with_current_engine");
  if (record.unitsPerCase === null || record.unitWeightKg === null || record.caseWeightKg === null) blockers.push("case_conversion_requires_approval");
  if (!record.routingClass) blockers.push("routing_class_requires_approval");
  if (record.routingClass && record.sellingEntity) blockers.push("dynamic_routing_cannot_have_static_selling_entity");
  if (record.routingClass === "OTHER" && (!record.routingBagEquivalent || new Prisma.Decimal(record.routingBagEquivalent).isZero())) {
    blockers.push("approved_routing_bag_equivalent_requires_review");
  }
  if (record.routingClass === "INSTANT_MIX" && record.routingBagEquivalent !== null) blockers.push("instant_mix_fixed_conversion_conflict");
  if (record.image.status !== "matched" && record.image.status !== "placeholder") blockers.push(record.image.status === "ambiguous" ? "image_mapping_ambiguous" : "image_missing");
  else if (record.image.status === "matched" && !record.image.assetPath) blockers.push("image_asset_not_prepared");
  return blockers;
}

function sourceRow(row: unknown[], rowNumber: number) {
  const price = row[8];
  if (typeof price !== "number" && typeof price !== "string") throw new Error(`row_${rowNumber}_price_missing`);
  const source = {
    typeOfItem: clean(row[1]),
    brandName: clean(row[2]),
    groupName: clean(row[3]),
    itemName: clean(row[4]),
    skuName: clean(row[5]),
    packingSize: clean(row[6]),
    masterBagBoxSize: clean(row[7]),
    pricePerQuintal: clean(price),
  };
  if (!source.typeOfItem || !source.brandName || !source.groupName || !source.skuName || !source.packingSize || !source.masterBagBoxSize || !source.pricePerQuintal) {
    throw new Error(`row_${rowNumber}_required_source_value_missing`);
  }
  return source;
}

function imageCandidates(source: RealCatalogueRecord["source"], imageIndex: DriveImageEntry[]) {
  const sku = identity(source.skuName);
  const packing = identity(source.packingSize);
  const keys = new Set([sku]);
  if (!parseSku(source.skuName)) keys.add(`${sku} ${packing}`);
  return imageIndex.filter((entry) => keys.has(fileKey(entry.fileName)));
}

function deriveRecord(source: RealCatalogueRecord["source"], sourceRows: number[], imageIndex: DriveImageEntry[]): RealCatalogueRecord {
  const parsed = deriveConversion(source);
  const master = parseMaster(source.masterBagBoxSize);
  const label = parsed?.label || clean(source.skuName);
  const productIdentity = [source.brandName, source.groupName, label].map(identity).join("|");
  const variantIdentity = [source.brandName, source.groupName, source.skuName, source.packingSize, source.masterBagBoxSize].map(identity).join("|");
  const productKey = `real-catalogue:product:${digest(productIdentity)}`;
  const variantKey = `real-catalogue:variant:${digest(variantIdentity)}`;
  const type = identity(source.typeOfItem);
  const brand = identity(source.brandName);
  const routingClass = brand === "LAXMI"
    ? "LAXMI_TOOR" as const
    : type === "INSTANT MIX" || identity(source.groupName).includes("INSTANT MIX")
      ? "INSTANT_MIX" as const
      : "OTHER" as const;
  const routingBagEquivalent = routingClass === "OTHER" && master?.container === "BAG" && parsed ? "1.000" : null;
  const candidates = imageCandidates(source, imageIndex);
  const imageStatus = candidates.length === 1 ? "matched" : candidates.length > 1 ? "ambiguous" : "missing";
  const image: RealCatalogueImage = {
    status: imageStatus,
    candidates,
    assetPath: imageStatus === "matched" ? `/catalog-images/real/${variantKey.slice("real-catalogue:variant:".length)}.jpg` : null,
  };
  const record: RealCatalogueRecord = {
    sourceRows,
    source,
    productKey,
    variantKey,
    productName: displayProductName(source.brandName, label),
    category: categoryFor(source.typeOfItem),
    unitSize: source.packingSize,
    unit: "kg",
    unitsPerCase: parsed?.unitsPerCase ?? null,
    unitWeightKg: parsed?.unitWeightKg ?? null,
    caseWeightKg: parsed?.caseWeightKg ?? null,
    conversionSource: parsed?.conversionSource ?? null,
    pricePerQuintal: source.pricePerQuintal,
    priceBasis: "quintal",
    masterContainer: master?.container ?? null,
    routingClass,
    routingBagEquivalent,
    image,
    readinessBlockers: [],
    catalogStatus: "pending_review",
  };
  record.readinessBlockers = readinessBlockersFor(record);
  record.catalogStatus = record.readinessBlockers.length ? "pending_review" : "active";
  return record;
}

export function buildRealCatalogueManifest(
  buffer: Buffer,
  fileName: string,
  imageIndex: DriveImageEntry[] = [],
): RealCatalogueManifest {
  const sourceSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true, cellDates: false, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("workbook_sheet_missing");
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
  const header = (matrix[1] ?? [])
    .slice(0, HEADER.length)
    .map((value) => clean(value).toUpperCase().replace(/\s*\/\s*/g, " "));
  const expectedHeader = HEADER.map((value) => value.replace(/\s*\/\s*/g, " "));
  if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) throw new Error("workbook_header_mismatch");

  const grouped = new Map<string, { source: RealCatalogueRecord["source"]; rows: number[] }>();
  const duplicateSourceRows: number[] = [];
  for (let index = 2; index < matrix.length; index += 1) {
    const rowNumber = index + 1;
    const row = matrix[index] ?? [];
    if (row.slice(1, HEADER.length).every((value) => clean(value) === "")) continue;
    const source = sourceRow(row, rowNumber);
    const key = [source.brandName, source.groupName, source.skuName, source.packingSize, source.masterBagBoxSize].map(identity).join("|");
    const prior = grouped.get(key);
    if (prior) {
      prior.rows.push(rowNumber);
      duplicateSourceRows.push(rowNumber);
      if (identity(prior.source.pricePerQuintal) !== identity(source.pricePerQuintal)) throw new Error(`conflicting_duplicate_variant_rows_${prior.rows.join("_")}`);
    } else grouped.set(key, { source, rows: [rowNumber] });
  }
  const records = [...grouped.values()].map(({ source, rows }) => deriveRecord(source, rows, imageIndex));
  const batchKey = `real-catalogue:${REAL_CATALOGUE_VERSION}:${sourceSha256}`;
  return {
    schemaVersion: 1,
    source: {
      fileName,
      sha256: sourceSha256,
      sheet: sheetName,
      headerRow: 2,
      dataRows: matrix.slice(2).filter((row) => (row ?? []).slice(1, HEADER.length).some((value) => clean(value) !== "")).length,
      uniqueVariantRows: records.length,
      duplicateSourceRows,
      version: REAL_CATALOGUE_VERSION,
      batchKey,
    },
    imageSource: {
      driveFolderUrl: DRIVE_FOLDER_URL,
      folderCount: new Set(imageIndex.map((entry) => entry.folderId)).size,
      fileCount: imageIndex.length,
    },
    records,
  };
}

export function readImageIndex(filePath?: string): DriveImageEntry[] {
  if (!filePath) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("image_index_must_be_an_array");
  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("image_index_entry_invalid");
    const value = entry as Record<string, unknown>;
    for (const key of ["folder", "folderId", "fileName", "driveFileId"]) if (typeof value[key] !== "string" || !value[key]) throw new Error(`image_index_${key}_missing`);
    return { folder: value.folder as string, folderId: value.folderId as string, fileName: value.fileName as string, driveFileId: value.driveFileId as string };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`invalid_decisions_${field}`);
  return value.trim();
}

function requirePositiveInteger(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new Error(`invalid_decisions_${field}`);
  return value as number;
}

function assertKeys(value: Record<string, unknown>, allowed: string[], field: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`invalid_decisions_${field}_${key}`);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function realCatalogueDecisionsSha256(decisions: RealCatalogueDecisions) {
  return digest(JSON.stringify(canonical(decisions)));
}

function normalizeDecisionRecord(value: unknown, index: number): RealCatalogueDecisionRecord {
  if (!isRecord(value)) throw new Error(`invalid_decisions_records_${index}`);
  assertKeys(value, [
    "variantKey", "productCatalogKey", "variantCatalogKey", "productInternalCode", "variantInternalCode",
    "hsnCode", "gstPercent", "gstPendingOrderAllowed", "ordering", "priceLists", "inventory", "routing", "image",
  ], `record_${index}`);
  const result: RealCatalogueDecisionRecord = { variantKey: requireString(value.variantKey, `records_${index}_variantKey`) };
  for (const key of ["productCatalogKey", "variantCatalogKey", "productInternalCode", "variantInternalCode", "hsnCode"] as const) {
    if (value[key] !== undefined) result[key] = requireString(value[key], `records_${index}_${key}`);
  }
  if (value.gstPercent !== undefined) {
    const gst = new Prisma.Decimal(decimalText(value.gstPercent as string | number, `records_${index}_gstPercent`, { maxPlaces: 2 }));
    if (gst.gt(100)) throw new Error(`invalid_decisions_records_${index}_gstPercent`);
    result.gstPercent = gst.toString();
  }
  if (value.gstPendingOrderAllowed !== undefined) {
    if (typeof value.gstPendingOrderAllowed !== "boolean") throw new Error(`invalid_decisions_records_${index}_gstPendingOrderAllowed`);
    result.gstPendingOrderAllowed = value.gstPendingOrderAllowed;
  }
  if (value.ordering !== undefined) {
    if (!isRecord(value.ordering)) throw new Error(`invalid_decisions_records_${index}_ordering`);
    assertKeys(value.ordering, ["unit", "unitsPerCase", "unitWeightKg", "caseWeightKg", "masterContainer"], `record_${index}_ordering`);
    const ordering: NonNullable<RealCatalogueDecisionRecord["ordering"]> = {};
    if (value.ordering.unit !== undefined) {
      if (value.ordering.unit !== "kg") throw new Error(`invalid_decisions_records_${index}_ordering_unit`);
      ordering.unit = "kg";
    }
    if (value.ordering.unitsPerCase !== undefined) ordering.unitsPerCase = requirePositiveInteger(value.ordering.unitsPerCase, `records_${index}_unitsPerCase`);
    if (value.ordering.unitWeightKg !== undefined) ordering.unitWeightKg = decimalText(value.ordering.unitWeightKg as string | number, `records_${index}_unitWeightKg`, { positive: true, maxPlaces: 3 });
    if (value.ordering.caseWeightKg !== undefined) ordering.caseWeightKg = decimalText(value.ordering.caseWeightKg as string | number, `records_${index}_caseWeightKg`, { positive: true, maxPlaces: 3 });
    if (value.ordering.masterContainer !== undefined) {
      if (value.ordering.masterContainer !== "BAG" && value.ordering.masterContainer !== "BOX") throw new Error(`invalid_decisions_records_${index}_masterContainer`);
      ordering.masterContainer = value.ordering.masterContainer;
    }
    if (ordering.unitsPerCase !== undefined && ordering.unitWeightKg !== undefined && ordering.caseWeightKg !== undefined) {
      if (!new Prisma.Decimal(ordering.unitWeightKg).mul(ordering.unitsPerCase).eq(ordering.caseWeightKg)) throw new Error(`invalid_decisions_records_${index}_conversion_mismatch`);
    }
    result.ordering = ordering;
  }
  if (value.priceLists !== undefined) {
    if (!Array.isArray(value.priceLists) || value.priceLists.length === 0) throw new Error(`invalid_decisions_records_${index}_priceLists`);
    const priceLists = value.priceLists.map((entry, priceIndex) => {
      if (!isRecord(entry)) throw new Error(`invalid_decisions_records_${index}_price_${priceIndex}`);
      assertKeys(entry, ["tierId", "rate", "rateBasis", "gstIncluded"], `record_${index}_price_${priceIndex}`);
      if (entry.rateBasis !== "case" && entry.rateBasis !== "quintal") throw new Error(`invalid_decisions_records_${index}_priceBasis_${priceIndex}`);
      if (typeof entry.gstIncluded !== "boolean") throw new Error(`invalid_decisions_records_${index}_gstBasis_${priceIndex}`);
      return {
        tierId: requireString(entry.tierId, `records_${index}_price_${priceIndex}_tierId`),
        rate: decimalText(entry.rate as string | number, `records_${index}_price_${priceIndex}_rate`, { positive: true, maxPlaces: 2 }),
        rateBasis: entry.rateBasis,
        gstIncluded: entry.gstIncluded,
      } satisfies RealCataloguePriceDecision;
    });
    if (new Set(priceLists.map((price) => price.tierId)).size !== priceLists.length) throw new Error(`invalid_decisions_records_${index}_duplicate_tier`);
    result.priceLists = priceLists;
  }
  if (value.inventory !== undefined) {
    if (!isRecord(value.inventory)) throw new Error(`invalid_decisions_records_${index}_inventory`);
    assertKeys(value.inventory, ["sapMaterialId", "internalMaterialId", "warehouseCode", "evidence"], `record_${index}_inventory`);
    const sapMaterialId = value.inventory.sapMaterialId === undefined ? undefined : requireString(value.inventory.sapMaterialId, `records_${index}_inventory_sapMaterialId`);
    const internalMaterialId = value.inventory.internalMaterialId === undefined ? undefined : requireString(value.inventory.internalMaterialId, `records_${index}_inventory_internalMaterialId`);
    if ((sapMaterialId === undefined) === (internalMaterialId === undefined)) throw new Error(`invalid_decisions_records_${index}_inventory_identity`);
    result.inventory = {
      ...(sapMaterialId === undefined ? {} : { sapMaterialId }),
      ...(internalMaterialId === undefined ? {} : { internalMaterialId }),
      warehouseCode: requireString(value.inventory.warehouseCode, `records_${index}_inventory_warehouseCode`),
      evidence: requireString(value.inventory.evidence, `records_${index}_inventory_evidence`),
    };
  }
  if (value.routing !== undefined) {
    if (!isRecord(value.routing)) throw new Error(`invalid_decisions_records_${index}_routing`);
    assertKeys(value.routing, ["routingClass", "routingBagEquivalent", "sellingEntity"], `record_${index}_routing`);
    if (value.routing.routingClass !== "LAXMI_TOOR" && value.routing.routingClass !== "INSTANT_MIX" && value.routing.routingClass !== "OTHER") throw new Error(`invalid_decisions_records_${index}_routingClass`);
    const routing: NonNullable<RealCatalogueDecisionRecord["routing"]> = { routingClass: value.routing.routingClass };
    if (value.routing.routingBagEquivalent !== undefined) routing.routingBagEquivalent = value.routing.routingBagEquivalent === null ? null : decimalText(value.routing.routingBagEquivalent as string | number, `records_${index}_routingBagEquivalent`, { positive: true, maxPlaces: 3 });
    if (value.routing.sellingEntity !== undefined) {
      if (value.routing.sellingEntity !== null && value.routing.sellingEntity !== "jain_traders" && value.routing.sellingEntity !== "padam_international") throw new Error(`invalid_decisions_records_${index}_sellingEntity`);
      routing.sellingEntity = value.routing.sellingEntity;
    }
    if (routing.routingClass === "LAXMI_TOOR" && routing.routingBagEquivalent !== undefined && routing.routingBagEquivalent !== null) throw new Error(`invalid_decisions_records_${index}_laxmi_conversion`);
    if (routing.routingClass === "INSTANT_MIX" && routing.routingBagEquivalent !== undefined && routing.routingBagEquivalent !== null) throw new Error(`invalid_decisions_records_${index}_instant_mix_conversion`);
    if (routing.routingClass !== undefined && routing.sellingEntity) throw new Error(`invalid_decisions_records_${index}_dynamic_sellingEntity`);
    if (routing.routingClass === "OTHER" && routing.routingBagEquivalent !== undefined && routing.routingBagEquivalent !== null && new Prisma.Decimal(routing.routingBagEquivalent).isZero()) throw new Error(`invalid_decisions_records_${index}_other_conversion`);
    result.routing = routing;
  }
  if (value.image !== undefined) {
    if (!isRecord(value.image)) throw new Error(`invalid_decisions_records_${index}_image`);
    assertKeys(value.image, ["driveFileId", "placeholderLabel", "mappingRevision", "evidence", "sourceFileSha256", "assetPath"], `record_${index}_image`);
    const mappingRevision = requireString(value.image.mappingRevision, `records_${index}_image_mappingRevision`);
    const evidence = value.image.evidence === undefined ? {} : { evidence: requireString(value.image.evidence, `records_${index}_image_evidence`) };
    if (value.image.placeholderLabel !== undefined) {
      if (value.image.placeholderLabel !== "Image coming soon") throw new Error(`invalid_decisions_records_${index}_image_placeholderLabel`);
      if (value.image.driveFileId !== undefined || value.image.sourceFileSha256 !== undefined || value.image.assetPath !== undefined) {
        throw new Error(`invalid_decisions_records_${index}_image_placeholder_fields`);
      }
      result.image = { placeholderLabel: "Image coming soon", mappingRevision, ...evidence };
    } else {
      result.image = {
        driveFileId: requireString(value.image.driveFileId, `records_${index}_image_driveFileId`),
        mappingRevision,
        ...evidence,
        ...(value.image.sourceFileSha256 === undefined ? {} : (() => {
          const sourceFileSha256 = requireString(value.image.sourceFileSha256, `records_${index}_image_sourceFileSha256`);
          if (!/^[a-f0-9]{64}$/i.test(sourceFileSha256)) throw new Error(`invalid_decisions_records_${index}_image_sourceFileSha256`);
          return { sourceFileSha256: sourceFileSha256.toLowerCase() };
        })()),
        ...(value.image.assetPath === undefined ? {} : { assetPath: requireString(value.image.assetPath, `records_${index}_image_assetPath`) }),
      };
    }
  }
  return result;
}

export function validateRealCatalogueDecisions(manifest: RealCatalogueManifest, input: unknown): RealCatalogueDecisions {
  if (!isRecord(input)) throw new Error("invalid_decisions_file");
  assertKeys(input, ["schemaVersion", "approval", "pricing", "gstPendingOrdering", "imageMappingRevision", "records", "retireCandidates"], "root");
  if (input.schemaVersion !== 1) throw new Error("unsupported_decisions_schema");
  if (!isRecord(input.approval)) throw new Error("invalid_decisions_approval");
  assertKeys(input.approval, ["approvalId", "revision", "approvedBy", "approvedAt", "scope", "decisionSource", "source"], "approval");
  if (!isRecord(input.approval.source)) throw new Error("invalid_decisions_approval_source");
  assertKeys(input.approval.source, ["workbookSha256", "sourceVersion", "imageIndexSha256"], "approval_source");
  if (input.approval.source.workbookSha256 !== manifest.source.sha256 || input.approval.source.sourceVersion !== manifest.source.version) throw new Error("decisions_source_does_not_match_manifest");
  if (input.approval.source.imageIndexSha256 !== undefined && input.approval.source.imageIndexSha256 !== manifest.imageSource.indexSha256) throw new Error("decisions_image_index_does_not_match_manifest");
  const approvalDate = new Date(requireString(input.approval.approvedAt, "approval_approvedAt"));
  if (Number.isNaN(approvalDate.getTime())) throw new Error("invalid_decisions_approvedAt");
  const revision = requirePositiveInteger(input.approval.revision, "approval_revision");
  const decisionSource = input.approval.decisionSource === undefined ? undefined : requireString(input.approval.decisionSource, "approval_decisionSource");
  let pricing: RealCataloguePricingDecision | undefined;
  if (input.pricing !== undefined) {
    if (!isRecord(input.pricing)) throw new Error("invalid_decisions_pricing");
    assertKeys(input.pricing, ["sourceRateBasis", "gstTreatment", "targetTierId", "targetTierStatus", "scope", "evidence"], "pricing");
    if (input.pricing.sourceRateBasis !== "quintal") throw new Error("invalid_decisions_pricing_sourceRateBasis");
    if (input.pricing.gstTreatment !== "exclusive") throw new Error("invalid_decisions_pricing_gstTreatment");
    if (input.pricing.targetTierId !== null) throw new Error("invalid_decisions_pricing_targetTierId");
    if (input.pricing.targetTierStatus !== "unresolved" && input.pricing.targetTierStatus !== "all_existing_tiers") throw new Error("invalid_decisions_pricing_targetTierStatus");
    if (input.pricing.targetTierStatus === "all_existing_tiers" && input.pricing.scope !== "all_retailers") throw new Error("invalid_decisions_pricing_scope");
    pricing = {
      sourceRateBasis: "quintal",
      gstTreatment: "exclusive",
      targetTierId: null,
      targetTierStatus: input.pricing.targetTierStatus,
      ...(input.pricing.scope === undefined ? {} : { scope: input.pricing.scope as "all_retailers" }),
      evidence: requireString(input.pricing.evidence, "pricing_evidence"),
    };
  }
  let gstPendingOrdering: RealCatalogueDecisions["gstPendingOrdering"] | undefined;
  if (input.gstPendingOrdering !== undefined) {
    if (!isRecord(input.gstPendingOrdering)) throw new Error("invalid_decisions_gstPendingOrdering");
    assertKeys(input.gstPendingOrdering, ["allowOrderBeforeGstFinalized", "invoiceBlockedUntilGstConfigured", "variantKeys", "evidence"], "gstPendingOrdering");
    if (input.gstPendingOrdering.allowOrderBeforeGstFinalized !== true || input.gstPendingOrdering.invoiceBlockedUntilGstConfigured !== true) {
      throw new Error("invalid_decisions_gstPendingOrdering_policy");
    }
    if (!Array.isArray(input.gstPendingOrdering.variantKeys) || input.gstPendingOrdering.variantKeys.length === 0 || input.gstPendingOrdering.variantKeys.some((key) => typeof key !== "string" || !key)) {
      throw new Error("invalid_decisions_gstPendingOrdering_variantKeys");
    }
    if (new Set(input.gstPendingOrdering.variantKeys as string[]).size !== input.gstPendingOrdering.variantKeys.length) throw new Error("invalid_decisions_gstPendingOrdering_duplicate_variant");
    const manifestKeys = new Set(manifest.records.map((record) => record.variantKey));
    if ((input.gstPendingOrdering.variantKeys as string[]).some((key) => !manifestKeys.has(key))) throw new Error("gstPendingOrdering_variant_not_in_manifest");
    gstPendingOrdering = {
      allowOrderBeforeGstFinalized: true,
      invoiceBlockedUntilGstConfigured: true,
      variantKeys: [...input.gstPendingOrdering.variantKeys] as string[],
      evidence: requireString(input.gstPendingOrdering.evidence, "gstPendingOrdering_evidence"),
    };
  }
  const imageMappingRevision = requireString(input.imageMappingRevision, "imageMappingRevision");
  if (!Array.isArray(input.records)) throw new Error("invalid_decisions_records");
  const records = input.records.map(normalizeDecisionRecord);
  if (new Set(records.map((record) => record.variantKey)).size !== records.length) throw new Error("duplicate_decisions_variantKey");
  const productInternalCodes = new Map<string, string>();
  const variantInternalCodes = new Map<string, string>();
  for (const [index, record] of records.entries()) {
    if (record.productInternalCode) {
      const prior = productInternalCodes.get(record.productInternalCode);
      if (prior && prior !== record.productCatalogKey) throw new Error(`duplicate_decisions_productInternalCode_${index}`);
      productInternalCodes.set(record.productInternalCode, record.productCatalogKey ?? record.variantKey);
    }
    if (record.variantInternalCode) {
      if (variantInternalCodes.has(record.variantInternalCode)) throw new Error(`duplicate_decisions_variantInternalCode_${index}`);
      variantInternalCodes.set(record.variantInternalCode, record.variantKey);
    }
  }
  const manifestByKey = new Map(manifest.records.map((record) => [record.variantKey, record]));
  for (const record of records) {
    const source = manifestByKey.get(record.variantKey);
    if (!source) throw new Error(`decision_variant_not_in_manifest_${record.variantKey}`);
    if (record.priceLists) {
      const sourceRateText = clean(source.source.pricePerQuintal).replace(/[₹,\s]/g, "");
      if (!/^\d+(?:\.\d+)?$/.test(sourceRateText)) throw new Error(`source_price_invalid_${record.variantKey}`);
      const sourceRate = new Prisma.Decimal(sourceRateText);
      for (const [priceIndex, price] of record.priceLists.entries()) {
        // The workbook explicitly supplies a quintal rate. A reviewed
        // decision may select its target tier, but it may not silently alter
        // that supplied amount when retaining the quintal basis.
        if (price.rateBasis === "quintal" && !new Prisma.Decimal(price.rate).eq(sourceRate)) {
          throw new Error(`decision_price_does_not_match_source_${record.variantKey}_${priceIndex}`);
        }
      }
    }
    if (record.image) {
      if (record.image.placeholderLabel) {
        if (source.image.status !== "missing") throw new Error(`decision_placeholder_requires_missing_image_${record.variantKey}`);
      } else {
        if (!record.image.driveFileId || !source.image.candidates.some((candidate) => candidate.driveFileId === record.image!.driveFileId)) throw new Error(`decision_image_not_a_candidate_${record.variantKey}`);
      }
      if (record.image.assetPath !== undefined) {
        const expectedAssetPath = `/catalog-images/real/${source.variantKey.replace(/^real-catalogue:variant:/, "")}.jpg`;
        if (record.image.assetPath !== expectedAssetPath) throw new Error(`decision_image_asset_path_invalid_${record.variantKey}`);
      }
    }
  }
  const retirement = input.retireCandidates;
  if (retirement !== undefined) {
    if (!Array.isArray(retirement)) throw new Error("invalid_decisions_retireCandidates");
    const retirementProductIds = new Set<string>();
    const retirementVariantIds = new Set<string>();
    for (const [index, candidate] of retirement.entries()) {
      if (!isRecord(candidate)) throw new Error(`invalid_decisions_retire_${index}`);
      assertKeys(candidate, ["productId", "expectedName", "expectedSapMaterialId", "variantIds", "reason"], `retire_${index}`);
      if (!Array.isArray(candidate.variantIds) || candidate.variantIds.length === 0 || candidate.variantIds.some((id) => typeof id !== "string" || !id)) throw new Error(`invalid_decisions_retire_${index}_variantIds`);
      requireString(candidate.productId, `retire_${index}_productId`);
      requireString(candidate.expectedName, `retire_${index}_expectedName`);
      if (candidate.expectedSapMaterialId !== null && candidate.expectedSapMaterialId !== undefined) requireString(candidate.expectedSapMaterialId, `retire_${index}_expectedSapMaterialId`);
      requireString(candidate.reason, `retire_${index}_reason`);
      if (retirementProductIds.has(candidate.productId as string)) throw new Error(`invalid_decisions_retire_${index}_duplicate_product`);
      retirementProductIds.add(candidate.productId as string);
      for (const variantId of candidate.variantIds as string[]) {
        if (retirementVariantIds.has(variantId)) throw new Error(`invalid_decisions_retire_${index}_duplicate_variant`);
        retirementVariantIds.add(variantId);
      }
    }
  }
  return {
    schemaVersion: 1,
    approval: {
      approvalId: requireString(input.approval.approvalId, "approval_approvalId"),
      revision,
      approvedBy: requireString(input.approval.approvedBy, "approval_approvedBy"),
      approvedAt: approvalDate.toISOString(),
      scope: requireString(input.approval.scope, "approval_scope"),
      ...(decisionSource === undefined ? {} : { decisionSource }),
      source: {
        workbookSha256: manifest.source.sha256,
        sourceVersion: manifest.source.version,
        ...(input.approval.source.imageIndexSha256 === undefined ? {} : { imageIndexSha256: requireString(input.approval.source.imageIndexSha256, "approval_source_imageIndexSha256") }),
      },
    },
    ...(pricing === undefined ? {} : { pricing }),
    ...(gstPendingOrdering === undefined ? {} : { gstPendingOrdering }),
    imageMappingRevision,
    records,
    ...(retirement === undefined ? {} : {
      retireCandidates: (retirement as Array<Record<string, unknown>>).map((candidate) => ({
        productId: candidate.productId as string,
        expectedName: candidate.expectedName as string,
        expectedSapMaterialId: candidate.expectedSapMaterialId === undefined ? null : candidate.expectedSapMaterialId as string | null,
        variantIds: candidate.variantIds as string[],
        reason: candidate.reason as string,
      })),
    }),
  };
}

function targetCatalogKey(record: RealCatalogueRecord, kind: "product" | "variant") {
  return kind === "product" ? record.catalogProductKey ?? record.productKey : record.catalogVariantKey ?? record.variantKey;
}

export function scopeRealCataloguePromotionManifest(manifest: RealCatalogueManifest, variantKeys?: string[]) {
  if (variantKeys === undefined) return manifest;
  if (variantKeys.length === 0 || new Set(variantKeys).size !== variantKeys.length) throw new Error("catalogue_promotion_scope_invalid");
  const manifestKeys = new Set(manifest.records.map(record => record.variantKey));
  if (variantKeys.some(key => !manifestKeys.has(key))) throw new Error("catalogue_promotion_scope_variant_not_in_manifest");
  const selected = new Set(variantKeys);
  return { ...manifest, records: manifest.records.filter(record => selected.has(record.variantKey)) };
}

export function resolveRealCatalogueDecisions(manifest: RealCatalogueManifest, input: unknown): { manifest: RealCatalogueManifest; decisions: RealCatalogueDecisions; approvalSha256: string } {
  const decisions = validateRealCatalogueDecisions(manifest, input);
  const allExistingTiersApproved = decisions.pricing?.targetTierStatus === "all_existing_tiers"
    && decisions.pricing.scope === "all_retailers";
  const byVariant = new Map(decisions.records.map((record) => [record.variantKey, record]));
  const records = manifest.records.map((source) => {
    const decision = byVariant.get(source.variantKey);
    if (!decision) return { ...source, readinessBlockers: readinessBlockersFor(source), catalogStatus: "pending_review" as const };
    const ordering = decision.ordering;
    const conversion = {
      unitsPerCase: ordering?.unitsPerCase ?? source.unitsPerCase,
      unitWeightKg: ordering?.unitWeightKg === undefined ? source.unitWeightKg : decimalText(ordering.unitWeightKg, `records_${source.variantKey}_unitWeightKg`, { positive: true, maxPlaces: 3 }),
      caseWeightKg: ordering?.caseWeightKg === undefined ? source.caseWeightKg : decimalText(ordering.caseWeightKg, `records_${source.variantKey}_caseWeightKg`, { positive: true, maxPlaces: 3 }),
    };
    if (conversion.unitsPerCase !== null && conversion.unitWeightKg !== null && conversion.caseWeightKg !== null && !new Prisma.Decimal(conversion.unitWeightKg).mul(conversion.unitsPerCase).eq(conversion.caseWeightKg)) throw new Error(`decision_conversion_mismatch_${source.variantKey}`);
    const routing = decision.routing;
    const imageDecision = decision.image;
    const catalogVariantKey = decision.variantCatalogKey ?? source.variantKey;
    const image = imageDecision
      ? imageDecision.placeholderLabel
        ? {
            status: "placeholder" as const,
            candidates: source.image.candidates,
            selectedDriveFileId: null,
            assetPath: null,
            placeholderLabel: imageDecision.placeholderLabel,
          }
        : {
            status: "matched" as const,
            candidates: source.image.candidates,
            selectedDriveFileId: imageDecision.driveFileId,
            assetPath: imageDecision.assetPath ?? source.image.assetPath ?? null,
          }
      : { ...source.image };
    const record: RealCatalogueRecord = {
      ...source,
      catalogProductKey: decision.productCatalogKey ?? source.catalogProductKey ?? null,
      catalogVariantKey,
      productInternalCode: decision.productInternalCode ?? source.productInternalCode ?? null,
      variantInternalCode: decision.variantInternalCode ?? source.variantInternalCode ?? null,
      hsnCode: decision.hsnCode ?? source.hsnCode ?? null,
      gstPercent: decision.gstPercent === undefined ? source.gstPercent ?? null : decimalText(decision.gstPercent, `records_${source.variantKey}_gstPercent`, { maxPlaces: 2 }),
      gstPendingOrderAllowed: decision.gstPendingOrderAllowed === true
        && decisions.gstPendingOrdering?.allowOrderBeforeGstFinalized === true
        && decisions.gstPendingOrdering.variantKeys.includes(source.variantKey),
      sellingEntity: routing?.sellingEntity === undefined ? source.sellingEntity ?? null : routing.sellingEntity,
      priceLists: decision.priceLists ?? source.priceLists ?? [],
      inventoryMapping: decision.inventory ?? source.inventoryMapping ?? null,
      unitsPerCase: conversion.unitsPerCase,
      unitWeightKg: conversion.unitWeightKg,
      caseWeightKg: conversion.caseWeightKg,
      conversionSource: ordering && (ordering.unitsPerCase !== undefined || ordering.unitWeightKg !== undefined || ordering.caseWeightKg !== undefined || ordering.masterContainer !== undefined)
        ? "approved_decision"
        : source.conversionSource,
      masterContainer: ordering?.masterContainer ?? source.masterContainer,
      routingClass: routing?.routingClass ?? source.routingClass,
      routingBagEquivalent: routing?.routingBagEquivalent === undefined
        ? source.routingBagEquivalent
        : routing.routingBagEquivalent === null
          ? null
          : decimalText(routing.routingBagEquivalent, `records_${source.variantKey}_routingBagEquivalent`, { positive: true, maxPlaces: 3 }),
      image,
      imageMappingRevision: imageDecision?.mappingRevision ?? source.imageMappingRevision ?? null,
      approvalId: decisions.approval.approvalId,
      approvalRevision: decisions.approval.revision,
      readinessBlockers: [],
      catalogStatus: "pending_review",
    };
    record.readinessBlockers = readinessBlockersFor(record, { allExistingTiersApproved });
    record.catalogStatus = record.readinessBlockers.length ? "pending_review" : "active";
    return record;
  });
  const seenProductKeys = new Set<string>();
  const seenVariantKeys = new Set<string>();
  for (const record of records) {
    const productKey = targetCatalogKey(record, "product");
    const variantKey = targetCatalogKey(record, "variant");
    if (seenProductKeys.has(productKey) && record.productInternalCode) {
      const prior = records.find((candidate) => targetCatalogKey(candidate, "product") === productKey && candidate !== record);
      if (prior && prior.productInternalCode !== record.productInternalCode) throw new Error(`conflicting_product_identity_decision_${productKey}`);
    }
    if (seenVariantKeys.has(variantKey)) throw new Error(`duplicate_variant_identity_decision_${variantKey}`);
    seenProductKeys.add(productKey);
    seenVariantKeys.add(variantKey);
  }
  const resolved: RealCatalogueManifest = { ...manifest, records };
  return { manifest: resolved, decisions, approvalSha256: realCatalogueDecisionsSha256(decisions) };
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sourceImportBatchKey(manifest: RealCatalogueManifest, approval?: RealCatalogueApprovalMetadata) {
  if (!approval) return manifest.source.batchKey;
  return `${manifest.source.batchKey}:configuration:${approval.approvalId}:r${approval.approvalRevision}:${approval.approvalSha256}:${approval.imageMappingRevision}`;
}

export function assertRealCatalogueTarget(databaseUrl: string, targetLabel: string, identity: Partial<RealCatalogueTargetIdentity> = {}) {
  if (!databaseUrl) throw new Error("catalogue_database_url_missing");
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (targetLabel === "disposable-local") {
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("disposable_target_must_be_local");
    return;
  }
  if (targetLabel !== "gagan-staging") throw new Error("catalogue_target_not_allowlisted");
  if (!process.env.REAL_CATALOGUE_ALLOW_STAGING) throw new Error("explicit_staging_guard_required");
  const supplied = {
    serviceName: identity.serviceName ?? process.env.REAL_CATALOGUE_SERVICE_NAME,
    serviceId: identity.serviceId ?? process.env.REAL_CATALOGUE_SERVICE_ID,
    hostname: identity.hostname ?? process.env.REAL_CATALOGUE_HOSTNAME,
    databaseName: identity.databaseName ?? process.env.REAL_CATALOGUE_DATABASE,
    schema: identity.schema ?? process.env.REAL_CATALOGUE_SCHEMA,
  };
  const actualSchema = url.searchParams.get("schema") ?? "public";
  if (databaseName !== REAL_CATALOGUE_STAGING_TARGET.databaseName || actualSchema !== REAL_CATALOGUE_STAGING_TARGET.schema) throw new Error("staging_database_identity_guard_failed");
  for (const key of ["serviceName", "serviceId", "hostname", "databaseName", "schema"] as const) {
    if (supplied[key] !== REAL_CATALOGUE_STAGING_TARGET[key]) throw new Error("staging_target_identity_guard_failed");
  }
}

function summaryFor(manifest: RealCatalogueManifest, values: Partial<RealCatalogueApplySummary> = {}) {
  const pendingReviewRows = manifest.records.filter((record) => record.catalogStatus === "pending_review").length;
  return {
    sourceSha256: manifest.source.sha256,
    batchKey: manifest.source.batchKey,
    createdProducts: 0,
    updatedProducts: 0,
    createdVariants: 0,
    updatedVariants: 0,
    blockedRows: manifest.records.filter((record) => record.unitsPerCase === null || record.unitWeightKg === null).length,
    skippedRows: manifest.records.filter((record) => record.unitsPerCase === null || record.unitWeightKg === null).length,
    preservedStatuses: 0,
    phase: "import" as const,
    pendingReviewRows,
    ...values,
  } satisfies RealCatalogueApplySummary;
}

function publicationImageState(record: RealCatalogueRecord) {
  if (record.image.status === "matched") {
    if (!record.image.assetPath) throw new Error(`catalogue_publication_image_asset_missing_${record.variantKey}`);
    return { catalogImageStatus: "exact" as const, catalogImageLabel: null, imageUrl: record.image.assetPath };
  }
  if (record.image.status === "placeholder") {
    return { catalogImageStatus: "placeholder" as const, catalogImageLabel: "Image coming soon", imageUrl: null };
  }
  return { catalogImageStatus: "pending" as const, catalogImageLabel: "Image pending confirmation", imageUrl: null };
}

/**
 * Publish the reviewed source catalogue for browsing without making it
 * orderable. `published` is deliberately distinct from `active`: the
 * commercial engine and order writer continue to accept only active rows,
 * while the catalogue APIs can show every reviewed real variant with an
 * explicit Ordering setup pending state.
 */
export async function publishRealCatalogueManifest(
  database: PrismaClient,
  manifest: RealCatalogueManifest,
  input: {
    actorStaffId: string;
    targetLabel: string;
    decisions: unknown;
    targetIdentity?: Partial<RealCatalogueTargetIdentity>;
  },
) {
  assertRealCatalogueTarget(process.env.DATABASE_URL ?? "", input.targetLabel, input.targetIdentity);
  const resolved = resolveRealCatalogueDecisions(manifest, input.decisions);
  if (resolved.decisions.pricing?.targetTierStatus !== "all_existing_tiers" || resolved.decisions.pricing.scope !== "all_retailers") {
    throw new Error("catalogue_publication_price_scope_not_approved");
  }
  const invalidRows = resolved.manifest.records.filter((record) =>
    !record.productInternalCode || !record.variantInternalCode ||
    record.unitsPerCase === null || record.unitWeightKg === null || record.caseWeightKg === null ||
    !record.routingClass || !/^(?:\d+)(?:\.\d+)?$/.test(record.pricePerQuintal)
  );
  if (invalidRows.length) throw new Error(`catalogue_publication_source_not_ready_${invalidRows.length}_rows`);

  const approvalSha256 = resolved.approvalSha256;
  const batchKey = `${manifest.source.batchKey}:publication:${resolved.decisions.approval.approvalId}:r${resolved.decisions.approval.revision}:${approvalSha256}:${resolved.decisions.imageMappingRevision}`;
  return database.$transaction(async (tx) => {
    const existing = await tx.catalogImportBatch.findUnique({ where: { batchKey } });
    if (existing?.status === "completed" || existing?.status === "completed_with_errors") {
      return (existing.summary as unknown as RealCatalogueApplySummary) ?? summaryFor(resolved.manifest, { batchKey, phase: "publish", approvalRevision: resolved.decisions.approval.revision, approvalSha256 });
    }

    const tiers = await tx.tier.findMany({ select: { id: true } });
    if (tiers.length === 0) throw new Error("catalogue_publication_no_price_tiers");
    const batch = existing ?? await tx.catalogImportBatch.create({
      data: {
        batchKey,
        sourceFileName: manifest.source.fileName,
        sourceSha256: manifest.source.sha256,
        sourceVersion: manifest.source.version,
        targetLabel: input.targetLabel,
        mode: "publication",
        status: "dry_run",
        createdByStaffId: input.actorStaffId,
        approvalId: resolved.decisions.approval.approvalId,
        approvalRevision: resolved.decisions.approval.revision,
        approvalSha256,
        approvalSource: "reviewed_decisions_file",
        approvalScope: json(resolved.decisions.approval.scope),
        imageMappingRevision: resolved.decisions.imageMappingRevision,
      },
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "applying", summary: json(summaryFor(resolved.manifest, { batchKey, phase: "publish", approvalRevision: resolved.decisions.approval.revision, approvalSha256 })) } });

    const productIds = new Map<string, string>();
    const variants: Array<{ record: RealCatalogueRecord; productId: string; variantId: string }> = [];
    for (const record of resolved.manifest.records) {
      const productKey = targetCatalogKey(record, "product");
      const variantKey = targetCatalogKey(record, "variant");
      const product = await tx.product.findUnique({ where: { catalogKey: productKey } });
      const variant = await tx.variant.findUnique({ where: { catalogKey: variantKey } });
      if (!product || !variant || variant.productId !== product.id) throw new Error(`catalogue_source_import_required_${record.variantKey}`);
      productIds.set(productKey, product.id);
      variants.push({ record, productId: product.id, variantId: variant.id });
    }

    const imageByProduct = new Map<string, string>();
    for (const { record, productId } of variants) {
      if (record.image.status === "matched" && record.image.assetPath && !imageByProduct.has(productId)) imageByProduct.set(productId, record.image.assetPath);
    }
    for (const [productId, imageUrl] of imageByProduct) {
      await tx.product.update({ where: { id: productId }, data: { catalogStatus: "published", imageUrl } });
    }
    const productsWithoutExactImage = new Set(variants.map(({ productId }) => productId));
    for (const productId of productsWithoutExactImage) {
      if (!imageByProduct.has(productId)) await tx.product.update({ where: { id: productId }, data: { catalogStatus: "published", imageUrl: null } });
    }

    let placeholderImages = 0;
    let pendingImages = 0;
    for (const { record, productId, variantId } of variants) {
      const image = publicationImageState(record);
      if (image.catalogImageStatus === "placeholder") placeholderImages += 1;
      if (image.catalogImageStatus === "pending") pendingImages += 1;
      await tx.variant.update({
        where: { id: variantId },
        data: {
          productId,
          catalogKey: targetCatalogKey(record, "variant"),
          internalCode: record.variantInternalCode!,
          catalogStatus: "published",
          imageUrl: image.imageUrl,
          catalogImageStatus: image.catalogImageStatus,
          catalogImageLabel: image.catalogImageLabel,
          unitSize: record.unitSize,
          unit: record.unit,
          unitsPerCase: record.unitsPerCase!,
          unitWeightKg: record.unitWeightKg!,
        },
      });
      for (const tier of tiers) {
        await tx.priceList.upsert({
          where: { tierId_variantId: { tierId: tier.id, variantId } },
          update: { price: record.pricePerQuintal, rateBasis: "quintal", productId },
          create: { tierId: tier.id, variantId, productId, price: record.pricePerQuintal, rateBasis: "quintal" },
        });
      }
    }
    const result = summaryFor(resolved.manifest, {
      batchKey,
      phase: "publish",
      approvalRevision: resolved.decisions.approval.revision,
      approvalSha256,
      updatedProducts: productIds.size,
      updatedVariants: variants.length,
      blockedRows: 0,
      skippedRows: 0,
      pendingReviewRows: 0,
      placeholderImages,
      pendingImages,
      publishedProducts: productIds.size,
      publishedVariants: variants.length,
      orderableVariants: 0,
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "completed", completedAt: new Date(), summary: json(result) } });
    return result;
  }, { timeout: 180_000, maxWait: 10_000 });
}

/**
 * Archive an explicit legacy/test allowlist without promoting the reviewed
 * catalogue. Publication intentionally leaves rows non-orderable while tax
 * and inventory setup is pending, so retirement must not be coupled to the
 * promotion readiness gate. The same identity, history and target guards as
 * promotion still apply; this operation only changes status and is
 * recoverable by a reviewed status restoration.
 */
export async function retireRealCatalogueCandidates(
  database: PrismaClient,
  manifest: RealCatalogueManifest,
  input: {
    actorStaffId: string;
    targetLabel: string;
    decisions: unknown;
    targetIdentity?: Partial<RealCatalogueTargetIdentity>;
  },
) {
  assertRealCatalogueTarget(process.env.DATABASE_URL ?? "", input.targetLabel, input.targetIdentity);
  const resolved = resolveRealCatalogueDecisions(manifest, input.decisions);
  const candidates = resolved.decisions.retireCandidates ?? [];
  if (candidates.length === 0) throw new Error("catalogue_retirement_candidates_missing");
  const approvalSha256 = resolved.approvalSha256;
  const batchKey = `${manifest.source.batchKey}:retirement:${resolved.decisions.approval.approvalId}:r${resolved.decisions.approval.revision}:${approvalSha256}`;
  return database.$transaction(async (tx) => {
    const existing = await tx.catalogImportBatch.findUnique({ where: { batchKey } });
    if (existing?.status === "completed" || existing?.status === "completed_with_errors") {
      return (existing.summary as unknown as RealCatalogueApplySummary) ?? summaryFor(resolved.manifest, { batchKey, phase: "retire", approvalRevision: resolved.decisions.approval.revision, approvalSha256 });
    }
    const batch = existing ?? await tx.catalogImportBatch.create({
      data: {
        batchKey,
        sourceFileName: manifest.source.fileName,
        sourceSha256: manifest.source.sha256,
        sourceVersion: manifest.source.version,
        targetLabel: input.targetLabel,
        mode: "retirement",
        status: "dry_run",
        createdByStaffId: input.actorStaffId,
        approvalId: resolved.decisions.approval.approvalId,
        approvalRevision: resolved.decisions.approval.revision,
        approvalSha256,
        approvalSource: "reviewed_decisions_file",
        approvalScope: json(resolved.decisions.approval.scope),
        imageMappingRevision: resolved.decisions.imageMappingRevision,
      },
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "applying", summary: json(summaryFor(resolved.manifest, { batchKey, phase: "retire", approvalRevision: resolved.decisions.approval.revision, approvalSha256 })) } });

    let retiredProducts = 0;
    let retiredVariants = 0;
    for (const candidate of candidates) {
      const product = await tx.product.findUnique({
        where: { id: candidate.productId },
        include: { variants: { select: { id: true } } },
      });
      if (!product) throw new Error(`catalogue_retirement_product_not_found_${candidate.productId}`);
      if (product.name !== candidate.expectedName || (product.sapMaterialId ?? null) !== candidate.expectedSapMaterialId) {
        throw new Error(`catalogue_retirement_identity_mismatch_${candidate.productId}`);
      }
      if (product.catalogKey !== null) throw new Error(`catalogue_retirement_requires_legacy_product_${candidate.productId}`);
      const actualVariantIds = product.variants.map((variant) => variant.id).sort();
      const requestedVariantIds = [...candidate.variantIds].sort();
      if (actualVariantIds.length !== requestedVariantIds.length || actualVariantIds.some((id, index) => id !== requestedVariantIds[index])) {
        throw new Error(`catalogue_retirement_variant_scope_mismatch_${candidate.productId}`);
      }
      const historicalOrderItems = await tx.orderItem.count({ where: { variantId: { in: candidate.variantIds } } });
      if (historicalOrderItems > 0) throw new Error(`catalogue_retirement_has_historical_orders_${candidate.productId}`);
      const alreadyArchived = product.catalogStatus === "archived" && (await tx.variant.count({ where: { id: { in: candidate.variantIds }, catalogStatus: "archived" } })) === candidate.variantIds.length;
      if (alreadyArchived) continue;
      await tx.variant.updateMany({ where: { id: { in: candidate.variantIds }, productId: product.id }, data: { catalogStatus: "archived" } });
      await tx.product.update({ where: { id: product.id }, data: { catalogStatus: "archived" } });
      retiredProducts += 1;
      retiredVariants += candidate.variantIds.length;
    }
    const result = summaryFor(resolved.manifest, {
      batchKey,
      phase: "retire",
      approvalRevision: resolved.decisions.approval.revision,
      approvalSha256,
      blockedRows: 0,
      skippedRows: 0,
      pendingReviewRows: 0,
      retiredProducts,
      retiredVariants,
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "completed", completedAt: new Date(), summary: json(result) } });
    return result;
  }, { timeout: 120_000, maxWait: 10_000 });
}

/**
 * Apply only the representable product-master fields. Commercial prices are
 * intentionally not written here: the workbook has no target tier, GST,
 * inventory/SAP code, or approved ownership mapping. A later reviewed
 * commercial configuration can promote a pending record without guessing.
 */
export async function applyRealCatalogueManifest(
  database: PrismaClient,
  manifest: RealCatalogueManifest,
  input: {
    actorStaffId: string;
    targetLabel: string;
    targetIdentity?: Partial<RealCatalogueTargetIdentity>;
    approval?: RealCatalogueApprovalMetadata;
  },
) {
  assertRealCatalogueTarget(process.env.DATABASE_URL ?? "", input.targetLabel, input.targetIdentity);
  const batchKey = sourceImportBatchKey(manifest, input.approval);
  return database.$transaction(async (tx) => {
    const existing = await tx.catalogImportBatch.findUnique({ where: { batchKey } });
    if (existing?.status === "completed" || existing?.status === "completed_with_errors") {
      return (existing.summary as unknown as RealCatalogueApplySummary) ?? summaryFor(manifest);
    }
    const batch = existing ?? await tx.catalogImportBatch.create({
      data: {
        batchKey,
        sourceFileName: manifest.source.fileName,
        sourceSha256: manifest.source.sha256,
        sourceVersion: manifest.source.version,
        targetLabel: input.targetLabel,
        mode: "source_import",
        status: "dry_run",
        createdByStaffId: input.actorStaffId,
        ...(input.approval ? {
          approvalId: input.approval.approvalId,
          approvalRevision: input.approval.approvalRevision,
          approvalSha256: input.approval.approvalSha256,
          approvalSource: "reviewed_decisions_file",
          approvalScope: json(input.approval.scope),
          imageMappingRevision: input.approval.imageMappingRevision,
        } : {}),
      },
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "applying", summary: json(summaryFor(manifest, { batchKey })) } });

    let createdProducts = 0;
    let updatedProducts = 0;
    let createdVariants = 0;
    let updatedVariants = 0;
    let blockedRows = 0;
    let preservedStatuses = 0;
    for (const record of manifest.records) {
      if (record.unitsPerCase === null || record.unitWeightKg === null) {
        blockedRows += 1;
        continue;
      }
      const productKey = targetCatalogKey(record, "product");
      const variantKey = targetCatalogKey(record, "variant");
      let product = await tx.product.findUnique({ where: { catalogKey: productKey } });
      if (product && productKey !== record.productKey) {
        const sourceProduct = await tx.product.findUnique({ where: { catalogKey: record.productKey } });
        if (sourceProduct && sourceProduct.id !== product.id) throw new Error(`catalogue_product_identity_conflict_${record.variantKey}`);
      }
      if (!product && productKey !== record.productKey) product = await tx.product.findUnique({ where: { catalogKey: record.productKey } });
      // Source import is never promotion. New identities remain pending even
      // when a reviewed manifest is used to preview the next configuration;
      // an existing lifecycle status is preserved for safe repeat imports.
      const productStatus = product?.catalogStatus ?? "pending_review";
      if (product?.catalogStatus) preservedStatuses += 1;
      const productData = {
        name: record.productName,
        category: record.category,
        catalogKey: productKey,
        catalogStatus: productStatus,
        ...(record.productInternalCode ? { internalCode: record.productInternalCode } : {}),
        ...(record.image.assetPath && !product?.imageUrl ? { imageUrl: record.image.assetPath } : {}),
      };
      const target = product
        ? await tx.product.update({ where: { id: product.id }, data: productData })
        : await tx.product.create({ data: productData });
      if (product) updatedProducts += 1; else createdProducts += 1;

      let variant = await tx.variant.findUnique({ where: { catalogKey: variantKey } });
      if (variant && variantKey !== record.variantKey) {
        const sourceVariant = await tx.variant.findUnique({ where: { catalogKey: record.variantKey } });
        if (sourceVariant && sourceVariant.id !== variant.id) throw new Error(`catalogue_variant_identity_conflict_${record.variantKey}`);
      }
      if (!variant && variantKey !== record.variantKey) variant = await tx.variant.findUnique({ where: { catalogKey: record.variantKey } });
      const variantStatus = variant?.catalogStatus ?? "pending_review";
      if (variant?.catalogStatus) preservedStatuses += 1;
      const variantData = {
        productId: target.id,
        catalogKey: variantKey,
        catalogStatus: variantStatus,
        unitSize: record.unitSize,
        unit: record.unit,
        unitsPerCase: record.unitsPerCase,
        unitWeightKg: record.unitWeightKg,
        ...(record.variantInternalCode ? { internalCode: record.variantInternalCode } : {}),
        ...(record.image.assetPath ? { imageUrl: record.image.assetPath } : {}),
      };
      if (variant) {
        // The workbook proposes a routing classification, but does not supply
        // the ownership/GST fields required by Variant_commercial_valid. Keep
        // the proposal in the manifest and leave accepted commercial fields
        // untouched on existing variants. New rows stay unconfigured until a
        // reviewed commercial configuration supplies the complete tuple.
        await tx.variant.update({ where: { id: variant.id }, data: variantData });
        updatedVariants += 1;
      } else {
        // Do not write reviewed routing metadata into an unconfigured row.
        // The accepted commercial constraint requires GST alongside routing;
        // promotion writes both together after all readiness gates pass.
        await tx.variant.create({ data: variantData });
        createdVariants += 1;
      }
    }
    const result = summaryFor(manifest, { batchKey, createdProducts, updatedProducts, createdVariants, updatedVariants, blockedRows, preservedStatuses });
    await tx.catalogImportBatch.update({
      where: { id: batch.id },
      data: { status: blockedRows ? "completed_with_errors" : "completed", completedAt: new Date(), summary: json(result) },
    });
    return result;
  }, { timeout: 120_000, maxWait: 10_000 });
}

/**
 * Promote an already imported source batch only after an explicit, validated
 * approval file resolves every readiness blocker. This is intentionally a
 * separate transaction from source import: importing a workbook never makes
 * a row orderable, and promotion never creates a second catalogue identity.
 */
export async function promoteRealCatalogueManifest(
  database: PrismaClient,
  manifest: RealCatalogueManifest,
  input: {
    actorStaffId: string;
    targetLabel: string;
    decisions: unknown;
    targetIdentity?: Partial<RealCatalogueTargetIdentity>;
    /** A reviewed release may promote a narrow approved subset while the
     * remainder stays published/non-orderable. */
    variantKeys?: string[];
    /** Full-catalogue callers retain the existing retirement behavior. A
     * scoped activation never retires unrelated legacy/test rows. */
    includeRetireCandidates?: boolean;
  },
) {
  assertRealCatalogueTarget(process.env.DATABASE_URL ?? "", input.targetLabel, input.targetIdentity);
  const resolved = resolveRealCatalogueDecisions(manifest, input.decisions);
  const scopedManifest = scopeRealCataloguePromotionManifest(resolved.manifest, input.variantKeys);
  const notReady = scopedManifest.records.filter((record) => record.readinessBlockers.length > 0);
  if (notReady.length) {
    throw new Error(`real_catalogue_not_ready_${notReady.length}_rows`);
  }
  const approvalSha256 = resolved.approvalSha256;
  const scopedVariantKeys = input.variantKeys ? [...input.variantKeys].sort() : null;
  const scopeSha256 = scopedVariantKeys ? crypto.createHash("sha256").update(JSON.stringify(scopedVariantKeys)).digest("hex") : "all";
  const batchKey = `${manifest.source.batchKey}:promotion:${resolved.decisions.approval.approvalId}:r${resolved.decisions.approval.revision}:${approvalSha256}:scope-${scopeSha256}`;
  return database.$transaction(async (tx) => {
    const prior = await tx.catalogImportBatch.findFirst({
      where: {
        sourceSha256: manifest.source.sha256,
        sourceVersion: manifest.source.version,
        mode: "promotion",
        approvalRevision: resolved.decisions.approval.revision,
      },
    });
    if (prior && (prior.approvalSha256 !== approvalSha256 || prior.imageMappingRevision !== resolved.decisions.imageMappingRevision)) {
      throw new Error("catalogue_approval_revision_conflict");
    }
    if (prior?.status === "completed" || prior?.status === "completed_with_errors") {
      return (prior.summary as unknown as RealCatalogueApplySummary) ?? summaryFor(scopedManifest, { batchKey, phase: "promote", approvalRevision: resolved.decisions.approval.revision, approvalSha256 });
    }
    const batch = prior ?? await tx.catalogImportBatch.create({
      data: {
        batchKey,
        sourceFileName: manifest.source.fileName,
        sourceSha256: manifest.source.sha256,
        sourceVersion: manifest.source.version,
        targetLabel: input.targetLabel,
        mode: "promotion",
        status: "dry_run",
        approvalId: resolved.decisions.approval.approvalId,
        approvalRevision: resolved.decisions.approval.revision,
        approvalSha256,
        approvalSource: "reviewed_decisions_file",
        approvalScope: json(resolved.decisions.approval.scope),
        imageMappingRevision: resolved.decisions.imageMappingRevision,
        createdByStaffId: input.actorStaffId,
      },
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "applying", summary: json(summaryFor(scopedManifest, { batchKey, phase: "promote", approvalRevision: resolved.decisions.approval.revision, approvalSha256 })) } });

    const tiers = await tx.tier.findMany({ select: { id: true } });
    const tierIds = new Set(tiers.map((tier) => tier.id));
    const allExistingTiersApproved = resolved.decisions.pricing?.targetTierStatus === "all_existing_tiers"
      && resolved.decisions.pricing.scope === "all_retailers";
    const priceChoicesFor = (record: RealCatalogueRecord) => record.priceLists?.length
      ? record.priceLists
      : allExistingTiersApproved
        ? tiers.map((tier) => ({ tierId: tier.id, rate: record.pricePerQuintal, rateBasis: "quintal" as const, gstIncluded: false }))
        : [];
    const productMapping = new Map<string, string>();
    for (const record of scopedManifest.records) {
      const productKey = targetCatalogKey(record, "product");
      const variantKey = targetCatalogKey(record, "variant");
      const inventory = record.inventoryMapping;
      if (!inventory || !tierIds.size) throw new Error(`catalogue_promotion_configuration_missing_${record.variantKey}`);
      const product = await tx.product.findUnique({ where: { catalogKey: productKey } });
      const variant = await tx.variant.findUnique({ where: { catalogKey: variantKey } });
      if (!product || !variant || variant.productId !== product.id) throw new Error(`catalogue_source_import_required_${record.variantKey}`);
      const usesInternalIdentity = inventory.internalMaterialId !== undefined;
      if (usesInternalIdentity && (!internalStagingInventoryEnabled() || product.sapMaterialId !== null)) {
        throw new Error(`catalogue_internal_inventory_requires_staging_mock_${record.variantKey}`);
      }
      const identity = usesInternalIdentity ? `internal:${inventory.internalMaterialId}` : `sap:${inventory.sapMaterialId}`;
      const mappingKey = usesInternalIdentity ? `${productKey}:${variantKey}` : productKey;
      if (productMapping.has(mappingKey) && productMapping.get(mappingKey) !== identity) throw new Error(`catalogue_product_inventory_mapping_conflict_${productKey}`);
      productMapping.set(mappingKey, identity);
      const snapshot = usesInternalIdentity
        ? await tx.inventorySnapshot.findUnique({ where: { internalMaterialId_warehouseCode: { internalMaterialId: inventory.internalMaterialId!, warehouseCode: inventory.warehouseCode } } })
        : await tx.inventorySnapshot.findUnique({ where: { sapMaterialId_warehouseCode: { sapMaterialId: inventory.sapMaterialId!, warehouseCode: inventory.warehouseCode } } });
      if (usesInternalIdentity && (!snapshot || snapshot.productId !== product.id || snapshot.variantId !== variant.id)) throw new Error(`catalogue_inventory_identity_mismatch_${record.variantKey}`);
      if (!snapshot || snapshot.status === "unavailable" || Number(snapshot.available) <= 0 || Date.now() - snapshot.syncedAt.getTime() > 60 * 60 * 1000) throw new Error(`catalogue_inventory_not_ready_${record.variantKey}`);
      for (const price of priceChoicesFor(record)) if (!tierIds.has(price.tierId)) throw new Error(`catalogue_price_tier_not_found_${price.tierId}`);
    }

    let updatedProducts = 0;
    let updatedVariants = 0;
    for (const record of scopedManifest.records) {
      const productKey = targetCatalogKey(record, "product");
      const variantKey = targetCatalogKey(record, "variant");
      const product = await tx.product.findUnique({ where: { catalogKey: productKey } });
      const variant = await tx.variant.findUnique({ where: { catalogKey: variantKey } });
      if (!product || !variant || variant.productId !== product.id) throw new Error(`catalogue_source_import_required_${record.variantKey}`);
      const inventory = record.inventoryMapping!;
      await tx.product.update({
        where: { id: product.id },
        data: {
          catalogKey: productKey,
          internalCode: record.productInternalCode!,
          ...(inventory.sapMaterialId === undefined ? {} : { sapMaterialId: inventory.sapMaterialId }),
          catalogStatus: "active",
          name: record.productName,
          category: record.category,
          ...(record.image.assetPath ? { imageUrl: record.image.assetPath } : {}),
        },
      });
      updatedProducts += 1;
      await tx.variant.update({
        where: { id: variant.id },
        data: {
          catalogKey: variantKey,
          internalCode: record.variantInternalCode!,
          catalogStatus: "active",
          imageUrl: record.image.assetPath ?? variant.imageUrl,
          hsnCode: record.hsnCode,
          sellingEntity: record.sellingEntity ?? null,
          gstPercent: record.gstPercent,
          gstPendingOrderAllowed: record.gstPendingOrderAllowed ?? false,
          routingClass: record.routingClass,
          routingBagEquivalent: record.routingBagEquivalent,
          unitSize: record.unitSize,
          unit: record.unit,
          unitsPerCase: record.unitsPerCase!,
          unitWeightKg: record.unitWeightKg!,
        },
      });
      updatedVariants += 1;
      for (const price of priceChoicesFor(record)) {
        await tx.priceList.upsert({
          where: { tierId_variantId: { tierId: price.tierId, variantId: variant.id } },
          update: { price: price.rate, rateBasis: price.rateBasis, productId: product.id },
          create: { tierId: price.tierId, variantId: variant.id, productId: product.id, price: price.rate, rateBasis: price.rateBasis },
        });
      }
    }
    let retiredProducts = 0;
    let retiredVariants = 0;
    const includeRetireCandidates = input.includeRetireCandidates ?? input.variantKeys === undefined;
    for (const candidate of includeRetireCandidates ? (resolved.decisions.retireCandidates ?? []) : []) {
      const product = await tx.product.findUnique({
        where: { id: candidate.productId },
        include: { variants: { select: { id: true } } },
      });
      if (!product) throw new Error(`catalogue_retirement_product_not_found_${candidate.productId}`);
      if (product.name !== candidate.expectedName || (product.sapMaterialId ?? null) !== candidate.expectedSapMaterialId) {
        throw new Error(`catalogue_retirement_identity_mismatch_${candidate.productId}`);
      }
      // A real imported identity is never eligible for the dummy/test
      // retirement allowlist. Archiving is deliberately recoverable and keeps
      // every historical relation intact.
      if (product.catalogKey !== null) throw new Error(`catalogue_retirement_requires_legacy_product_${candidate.productId}`);
      const actualVariantIds = product.variants.map((variant) => variant.id).sort();
      const requestedVariantIds = [...candidate.variantIds].sort();
      if (actualVariantIds.length !== requestedVariantIds.length || actualVariantIds.some((id, index) => id !== requestedVariantIds[index])) {
        throw new Error(`catalogue_retirement_variant_scope_mismatch_${candidate.productId}`);
      }
      const historicalOrderItems = await tx.orderItem.count({ where: { variantId: { in: candidate.variantIds } } });
      if (historicalOrderItems > 0) throw new Error(`catalogue_retirement_has_historical_orders_${candidate.productId}`);
      await tx.variant.updateMany({ where: { id: { in: candidate.variantIds }, productId: product.id }, data: { catalogStatus: "archived" } });
      await tx.product.update({ where: { id: product.id }, data: { catalogStatus: "archived" } });
      retiredProducts += 1;
      retiredVariants += candidate.variantIds.length;
    }
    const result = summaryFor(scopedManifest, {
      batchKey,
      phase: "promote",
      approvalRevision: resolved.decisions.approval.revision,
      approvalSha256,
      updatedProducts,
      updatedVariants,
      blockedRows: 0,
      skippedRows: 0,
      pendingReviewRows: 0,
      retiredProducts,
      retiredVariants,
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "completed", completedAt: new Date(), summary: json(result) } });
    return result;
  }, { timeout: 120_000, maxWait: 10_000 });
}
