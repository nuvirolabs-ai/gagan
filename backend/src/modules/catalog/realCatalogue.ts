import crypto from "node:crypto";
import fs from "node:fs";
import * as XLSX from "xlsx";
import { Prisma, type PrismaClient } from "@prisma/client";

export const REAL_CATALOGUE_VERSION = "sku-wise-item-list-2026-09-16-v1";
export const REAL_CATALOGUE_SOURCE_FILE = "SKU WISE ITEM LIST – 16-09-26-UPDATED.xlsx";
export const REAL_CATALOGUE_STATUSES = ["active", "pending_review", "archived", "test"] as const;
export type RealCatalogueStatus = (typeof REAL_CATALOGUE_STATUSES)[number];

export type DriveImageEntry = {
  folder: string;
  folderId: string;
  fileName: string;
  driveFileId: string;
};

export type RealCatalogueImage = {
  status: "matched" | "ambiguous" | "missing";
  candidates: DriveImageEntry[];
  /** Root-relative path served by the existing private application asset. */
  assetPath: string | null;
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
  productName: string;
  category: string;
  unitSize: string;
  unit: "kg";
  unitsPerCase: number | null;
  unitWeightKg: string | null;
  caseWeightKg: string | null;
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
};

const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1JJMyEPQSVtWstUaovGZCFMgpllnTg92e";
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
  const parsed = parseSku(source.skuName);
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
  const readinessBlockers = [
    "stable_sku_or_sap_code_missing_from_source",
    "gst_percent_missing_from_source",
    "inventory_mapping_missing_from_source",
    "price_tier_missing_from_source",
  ];
  if (!parsed) readinessBlockers.push("case_conversion_missing_from_source");
  if (routingClass === "OTHER" && !routingBagEquivalent) readinessBlockers.push("approved_routing_bag_equivalent_requires_review");
  if (imageStatus !== "matched") readinessBlockers.push(imageStatus === "ambiguous" ? "image_mapping_ambiguous" : "image_missing");
  return {
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
    pricePerQuintal: source.pricePerQuintal,
    priceBasis: "quintal",
    masterContainer: master?.container ?? null,
    routingClass,
    routingBagEquivalent,
    image,
    readinessBlockers,
    catalogStatus: readinessBlockers.length ? "pending_review" : "active",
  };
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

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function assertRealCatalogueTarget(databaseUrl: string, targetLabel: string) {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, "");
  if (targetLabel === "disposable-local") {
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") throw new Error("disposable_target_must_be_local");
    return;
  }
  if (targetLabel !== "gagan-staging") throw new Error("catalogue_target_not_allowlisted");
  if (!process.env.REAL_CATALOGUE_ALLOW_STAGING) throw new Error("explicit_staging_guard_required");
  if (!databaseName.startsWith("gagan_staging_")) throw new Error("staging_database_identity_guard_failed");
}

function summaryFor(manifest: RealCatalogueManifest, values: Partial<RealCatalogueApplySummary> = {}) {
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
    ...values,
  } satisfies RealCatalogueApplySummary;
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
  input: { actorStaffId: string; targetLabel: string },
) {
  assertRealCatalogueTarget(process.env.DATABASE_URL ?? "", input.targetLabel);
  if (input.targetLabel === "gagan-staging" && manifest.records.some((record) => record.catalogStatus !== "active")) {
    throw new Error("real_catalogue_not_ready_for_staging");
  }
  return database.$transaction(async (tx) => {
    const existing = await tx.catalogImportBatch.findUnique({ where: { batchKey: manifest.source.batchKey } });
    if (existing?.status === "completed" || existing?.status === "completed_with_errors") {
      return (existing.summary as unknown as RealCatalogueApplySummary) ?? summaryFor(manifest);
    }
    const batch = existing ?? await tx.catalogImportBatch.create({
      data: {
        batchKey: manifest.source.batchKey,
        sourceFileName: manifest.source.fileName,
        sourceSha256: manifest.source.sha256,
        sourceVersion: manifest.source.version,
        targetLabel: input.targetLabel,
        mode: "apply",
        status: "dry_run",
        createdByStaffId: input.actorStaffId,
      },
    });
    await tx.catalogImportBatch.update({ where: { id: batch.id }, data: { status: "applying", summary: json(summaryFor(manifest)) } });

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
      const product = await tx.product.findUnique({ where: { catalogKey: record.productKey } });
      const productStatus = product?.catalogStatus ?? record.catalogStatus;
      if (product?.catalogStatus) preservedStatuses += 1;
      const productData = {
        name: record.productName,
        category: record.category,
        catalogKey: record.productKey,
        catalogStatus: productStatus,
        ...(record.image.assetPath && !product?.imageUrl ? { imageUrl: record.image.assetPath } : {}),
      };
      const target = product
        ? await tx.product.update({ where: { id: product.id }, data: productData })
        : await tx.product.create({ data: productData });
      if (product) updatedProducts += 1; else createdProducts += 1;

      const variant = await tx.variant.findUnique({ where: { catalogKey: record.variantKey } });
      const variantStatus = variant?.catalogStatus ?? record.catalogStatus;
      if (variant?.catalogStatus) preservedStatuses += 1;
      const variantData = {
        productId: target.id,
        catalogKey: record.variantKey,
        catalogStatus: variantStatus,
        unitSize: record.unitSize,
        unit: record.unit,
        unitsPerCase: record.unitsPerCase,
        unitWeightKg: record.unitWeightKg,
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
        await tx.variant.create({ data: { ...variantData, routingClass: null, routingBagEquivalent: null } });
        createdVariants += 1;
      }
    }
    const result = summaryFor(manifest, { createdProducts, updatedProducts, createdVariants, updatedVariants, blockedRows, preservedStatuses });
    await tx.catalogImportBatch.update({
      where: { id: batch.id },
      data: { status: blockedRows ? "completed_with_errors" : "completed", completedAt: new Date(), summary: json(result) },
    });
    return result;
  }, { timeout: 120_000, maxWait: 10_000 });
}
