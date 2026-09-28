import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

export type ClientUatSourceType = "products" | "pricing" | "retailers" | "assignments";

export type SourceRef = {
  filename: string;
  sha256: string;
  sheet: string;
  rowNumber: number;
};

export type ClientUatProduct = SourceRef & {
  canonicalKey: string;
  productName: string;
  category: string;
  unitSize: string;
  unit: string;
  unitsPerCase: number;
  unitWeightKg: number;
  description: string | null;
  imageUrl: string | null;
  sapMaterialId: string | null;
};

export type ClientUatPrice = SourceRef & {
  canonicalKey: string;
  productName: string;
  unitSize: string;
  unitsPerCase: number;
  sourceUnitsPerCase: number | null;
  pricePerKg: number;
  casePrice: number;
  sourceTier: string | null;
  sourceVariantId: string | null;
};

export type ClientUatRetailer = SourceRef & {
  name: string;
  phone: string;
  shopAddress: string;
  salespersonEmployeeRef: string;
  sapCustomerId: string | null;
};

export type ClientUatAssignment = SourceRef & {
  retailerPhone: string;
  salespersonEmployeeRef: string;
};

export type ClientUatDuplicate = {
  sourceType: "products" | "pricing";
  key: string;
  rows: number[];
  chosenRow: number;
};

export type ClientUatConflict = {
  sourceType: "products" | "pricing";
  key: string;
  rows: number[];
  chosenRow: number;
  fields: string[];
  chosenValues: Record<string, string | number | null>;
};

export type ClientUatSourceFile = {
  type: ClientUatSourceType;
  filename: string;
  sha256: string;
  sheet: string;
  rawRowCount: number;
};

export type ClientUatSource = {
  sources: Record<ClientUatSourceType, ClientUatSourceFile>;
  products: ClientUatProduct[];
  pricing: ClientUatPrice[];
  retailers: ClientUatRetailer[];
  assignments: ClientUatAssignment[];
  duplicates: ClientUatDuplicate[];
  conflicts: ClientUatConflict[];
  pricingBasis: "INR/kg";
  counts: {
    rawProductRows: number;
    rawPricingRows: number;
    rawRetailerRows: number;
    rawAssignmentRows: number;
    canonicalSkuCount: number;
    duplicatesCollapsed: number;
    pricingConflictsResolved: number;
  };
};

export type ClientUatSourceBuffers = {
  products: { filename: string; buffer: Buffer };
  pricing: { filename: string; buffer: Buffer };
  retailers: { filename: string; buffer: Buffer };
  assignments: { filename: string; buffer: Buffer };
};

export type ClientUatSourcePaths = Record<ClientUatSourceType, string>;

export class ClientUatSourceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ClientUatSourceError";
  }
}

type CellRow = unknown[];

function clean(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizedText(value: unknown): string {
  return clean(value).toUpperCase();
}

function normalizedUnitSize(value: unknown): string {
  return normalizedText(value).replace(/\s+(KG|KGS|GM|G|GRAMS|QUINTAL|QTL)\b/g, "$1");
}

function normalizedUnit(value: unknown): string {
  return normalizedText(value).replace(/S$/, "");
}

function normalizedPhone(value: unknown): string {
  const digits = clean(value).replace(/\D/g, "");
  return /^91\d{10}$/.test(digits) ? digits.slice(2) : digits;
}

function numeric(value: unknown, field: string, ref: SourceRef): number {
  const parsed = typeof value === "number" ? value : Number(clean(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) throw new ClientUatSourceError("invalid_number", `${field} is not numeric at ${ref.filename}:${ref.rowNumber}`);
  return parsed;
}

function positiveInteger(value: unknown, field: string, ref: SourceRef): number {
  const parsed = numeric(value, field, ref);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new ClientUatSourceError("invalid_positive_integer", `${field} must be a positive integer at ${ref.filename}:${ref.rowNumber}`);
  return parsed;
}

function positiveNumber(value: unknown, field: string, ref: SourceRef): number {
  const parsed = numeric(value, field, ref);
  if (parsed <= 0) throw new ClientUatSourceError("invalid_positive_number", `${field} must be positive at ${ref.filename}:${ref.rowNumber}`);
  return parsed;
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sourceRef(file: ClientUatSourceFile, rowNumber: number): SourceRef {
  return { filename: file.filename, sha256: file.sha256, sheet: file.sheet, rowNumber };
}

function isMetadataRow(row: CellRow): boolean {
  const values = row.map(clean).filter(Boolean).map(normalizedText);
  if (!values.length || !["REQUIRED", "OPTIONAL", "REQ", "OPT"].includes(values[0])) return false;
  return values.slice(1).every((value) => ["REQUIRED", "OPTIONAL", "REQ", "OPT", "0"].includes(value));
}

function isBlankRow(row: CellRow): boolean {
  return row.every((value) => clean(value) === "");
}

function headerMap(rows: CellRow[], required: string[], filename: string) {
  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    const map = new Map(rows[index].map((value, column) => [normalizedText(value).toLowerCase(), column]));
    if (required.every((field) => map.has(field))) return { rowIndex: index, map };
  }
  throw new ClientUatSourceError("header_not_found", `Required columns were not found in ${filename}`);
}

function value(row: CellRow, map: Map<string, number>, field: string): unknown {
  return row[map.get(field) ?? -1];
}

function worksheet(file: { filename: string; buffer: Buffer }, type: ClientUatSourceType, required: string[]) {
  const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.SheetNames[0];
  if (!sheet) throw new ClientUatSourceError("sheet_not_found", `No worksheet found in ${file.filename}`);
  const worksheet = workbook.Sheets[sheet];
  const rows = XLSX.utils.sheet_to_json<CellRow>(worksheet, { header: 1, defval: "", raw: true });
  const header = headerMap(rows, required, file.filename);
  const fileMeta: ClientUatSourceFile = { type, filename: file.filename, sha256: sha256(file.buffer), sheet, rawRowCount: 0 };
  const data = rows.slice(header.rowIndex + 1).flatMap((row, index) => {
    const rowNumber = header.rowIndex + index + 2;
    if (isBlankRow(row) || isMetadataRow(row)) return [];
    fileMeta.rawRowCount += 1;
    return [{ row, rowNumber, ref: sourceRef(fileMeta, rowNumber) }];
  });
  return { worksheet, map: header.map, file: fileMeta, data };
}

function productJoinKey(productName: string, unitSize: string, unitsPerCase: number): string {
  return [normalizedText(productName), normalizedUnitSize(unitSize), unitsPerCase].join("|");
}

export function clientUatCanonicalKey(input: {
  productName: string;
  unitSize: string;
  unit: string;
  unitsPerCase: number;
  unitWeightKg: number;
}): string {
  return [
    normalizedText(input.productName),
    normalizedUnitSize(input.unitSize),
    normalizedUnit(input.unit),
    input.unitsPerCase,
    Number(input.unitWeightKg.toFixed(3)),
  ].join("|");
}

function unsafeTemplateValue(value: string | null): boolean {
  return Boolean(value && (/example\.invalid/i.test(value) || /^MAT-IMPORT-/i.test(value)));
}

function sanitizedOptional(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned && !unsafeTemplateValue(cleaned) ? cleaned : null;
}

function chosenRows<T extends { rowNumber: number }>(rows: T[]): T {
  return rows[rows.length - 1];
}

function differingFields<T extends Record<string, unknown>>(rows: T[], fields: string[]): string[] {
  return fields.filter((field) => new Set(rows.map((row) => JSON.stringify(row[field] ?? null))).size > 1);
}

function parseProducts(file: ClientUatSourceBuffers["products"]) {
  const parsed = worksheet(file, "products", ["product_name", "unit_size", "unit", "units_per_case", "unit_weight_kg"]);
  const rows = parsed.data.map(({ row, rowNumber, ref }) => {
    const productName = clean(value(row, parsed.map, "product_name"));
    const unitSize = clean(value(row, parsed.map, "unit_size"));
    const unit = clean(value(row, parsed.map, "unit"));
    if (!productName || !unitSize || !unit) throw new ClientUatSourceError("required_product_value_missing", `Required product value missing at ${file.filename}:${rowNumber}`);
    const unitsPerCase = positiveInteger(value(row, parsed.map, "units_per_case"), "units_per_case", ref);
    const unitWeightKg = positiveNumber(value(row, parsed.map, "unit_weight_kg"), "unit_weight_kg", ref);
    const imageUrl = sanitizedOptional(value(row, parsed.map, "image_url"));
    const hasUnsafeTemplateMetadata = unsafeTemplateValue(clean(value(row, parsed.map, "image_url")))
      || unsafeTemplateValue(clean(value(row, parsed.map, "sap_material_id")));
    return {
      ...ref,
      canonicalKey: clientUatCanonicalKey({ productName, unitSize, unit, unitsPerCase, unitWeightKg }),
      productName,
      category: clean(value(row, parsed.map, "category")) || "Uncategorised",
      unitSize,
      unit,
      unitsPerCase,
      unitWeightKg,
      description: hasUnsafeTemplateMetadata ? null : sanitizedOptional(value(row, parsed.map, "description")),
      imageUrl,
      sapMaterialId: hasUnsafeTemplateMetadata ? null : sanitizedOptional(value(row, parsed.map, "sap_material_id")),
    } satisfies ClientUatProduct;
  });
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) grouped.set(row.canonicalKey, [...(grouped.get(row.canonicalKey) ?? []), row]);
  const duplicates: ClientUatDuplicate[] = [];
  const conflicts: ClientUatConflict[] = [];
  const products: ClientUatProduct[] = [];
  for (const [key, group] of grouped) {
    const chosen = chosenRows(group);
    if (group.length > 1) {
      duplicates.push({ sourceType: "products", key, rows: group.map((row) => row.rowNumber), chosenRow: chosen.rowNumber });
      const fields = differingFields(group, ["category", "description", "imageUrl", "sapMaterialId"]);
      if (fields.length) conflicts.push({ sourceType: "products", key, rows: group.map((row) => row.rowNumber), chosenRow: chosen.rowNumber, fields, chosenValues: Object.fromEntries(fields.map((field) => [field, chosen[field as keyof ClientUatProduct] as string | null])) });
    }
    products.push(chosen);
  }
  return { file: parsed.file, products, duplicates, conflicts };
}

function pricingComment(worksheet: XLSX.WorkSheet, map: Map<string, number>): string {
  const column = map.get("price");
  if (column == null) return "";
  const address = XLSX.utils.encode_cell({ r: 0, c: column });
  const cell = worksheet[address] as (XLSX.CellObject & { c?: Array<{ t?: string }> }) | undefined;
  return (cell?.c ?? []).map((comment) => comment.t ?? "").join(" ").trim();
}

function parsePricing(file: ClientUatSourceBuffers["pricing"], products: ClientUatProduct[]) {
  const parsed = worksheet(file, "pricing", ["tier", "product_name", "unit_size", "price", "units_per_case"]);
  const comment = pricingComment(parsed.worksheet, parsed.map);
  if (!/price\s*\/\s*kg/i.test(comment)) throw new ClientUatSourceError("pricing_basis_missing", `Pricing workbook ${file.filename} must document Price/kg in the price header comment`);
  const productByJoin = new Map<string, ClientUatProduct[]>();
  const productByNamePack = new Map<string, ClientUatProduct[]>();
  for (const product of products) productByJoin.set(productJoinKey(product.productName, product.unitSize, product.unitsPerCase), [...(productByJoin.get(productJoinKey(product.productName, product.unitSize, product.unitsPerCase)) ?? []), product]);
  for (const product of products) {
    const key = [normalizedText(product.productName), normalizedUnitSize(product.unitSize)].join("|");
    productByNamePack.set(key, [...(productByNamePack.get(key) ?? []), product]);
  }
  const rows = parsed.data.map(({ row, rowNumber, ref }) => {
    const productName = clean(value(row, parsed.map, "product_name"));
    const unitSize = clean(value(row, parsed.map, "unit_size"));
    const suppliedUnitsPerCase = clean(value(row, parsed.map, "units_per_case"));
    const sourceUnitsPerCase = suppliedUnitsPerCase ? positiveInteger(suppliedUnitsPerCase, "units_per_case", ref) : null;
    const matches = sourceUnitsPerCase == null
      ? productByNamePack.get([normalizedText(productName), normalizedUnitSize(unitSize)].join("|")) ?? []
      : productByJoin.get(productJoinKey(productName, unitSize, sourceUnitsPerCase)) ?? [];
    if (matches.length !== 1) throw new ClientUatSourceError("pricing_product_ambiguous", `Pricing row ${file.filename}:${rowNumber} does not match exactly one product pack`);
    const product = matches[0];
    const pricePerKg = positiveNumber(value(row, parsed.map, "price"), "price", ref);
    const casePrice = Number((pricePerKg * product.unitWeightKg * product.unitsPerCase).toFixed(2));
    return {
      ...ref,
      canonicalKey: product.canonicalKey,
      productName,
      unitSize,
      unitsPerCase: product.unitsPerCase,
      sourceUnitsPerCase,
      pricePerKg,
      casePrice,
      sourceTier: sanitizedOptional(value(row, parsed.map, "tier")),
      sourceVariantId: sanitizedOptional(value(row, parsed.map, "variant_id")),
    } satisfies ClientUatPrice;
  });
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) grouped.set(row.canonicalKey, [...(grouped.get(row.canonicalKey) ?? []), row]);
  const duplicates: ClientUatDuplicate[] = [];
  const conflicts: ClientUatConflict[] = [];
  const pricing: ClientUatPrice[] = [];
  for (const [key, group] of grouped) {
    const chosen = chosenRows(group);
    if (group.length > 1) {
      duplicates.push({ sourceType: "pricing", key, rows: group.map((row) => row.rowNumber), chosenRow: chosen.rowNumber });
      const fields = differingFields(group, ["pricePerKg", "casePrice", "sourceUnitsPerCase", "sourceTier", "sourceVariantId"]);
      if (fields.length) conflicts.push({ sourceType: "pricing", key, rows: group.map((row) => row.rowNumber), chosenRow: chosen.rowNumber, fields, chosenValues: Object.fromEntries(fields.map((field) => [field, chosen[field as keyof ClientUatPrice] as string | number | null])) });
    }
    pricing.push(chosen);
  }
  return { file: parsed.file, pricing, duplicates, conflicts };
}

function parseRetailers(file: ClientUatSourceBuffers["retailers"]) {
  const parsed = worksheet(file, "retailers", ["name", "phone", "shop_address", "salesperson_employee_ref"]);
  const retailers = parsed.data.map(({ row, rowNumber, ref }) => {
    const phone = normalizedPhone(value(row, parsed.map, "phone"));
    const salespersonEmployeeRef = normalizedText(value(row, parsed.map, "salesperson_employee_ref"));
    if (!phone || phone.length < 10 || !salespersonEmployeeRef) throw new ClientUatSourceError("invalid_retailer_row", `Retailer identity missing at ${file.filename}:${rowNumber}`);
    return {
      ...ref,
      name: clean(value(row, parsed.map, "name")),
      phone,
      shopAddress: clean(value(row, parsed.map, "shop_address")),
      salespersonEmployeeRef,
      sapCustomerId: sanitizedOptional(value(row, parsed.map, "sap_customer_id")),
    } satisfies ClientUatRetailer;
  });
  const phones = new Set<string>();
  for (const retailer of retailers) {
    if (phones.has(retailer.phone)) throw new ClientUatSourceError("duplicate_retailer_phone", `Duplicate normalized retailer phone ${retailer.phone}`);
    phones.add(retailer.phone);
  }
  return { file: parsed.file, retailers };
}

function parseAssignments(file: ClientUatSourceBuffers["assignments"]) {
  const parsed = worksheet(file, "assignments", ["retailer_phone", "salesperson_employee_ref"]);
  const assignments = parsed.data.map(({ row, rowNumber, ref }) => {
    const retailerPhone = normalizedPhone(value(row, parsed.map, "retailer_phone"));
    const salespersonEmployeeRef = normalizedText(value(row, parsed.map, "salesperson_employee_ref"));
    if (!retailerPhone || retailerPhone.length < 10 || !salespersonEmployeeRef) throw new ClientUatSourceError("invalid_assignment_row", `Assignment identity missing at ${file.filename}:${rowNumber}`);
    return { ...ref, retailerPhone, salespersonEmployeeRef } satisfies ClientUatAssignment;
  });
  const phones = new Set<string>();
  for (const assignment of assignments) {
    if (phones.has(assignment.retailerPhone)) throw new ClientUatSourceError("duplicate_assignment_phone", `Duplicate normalized assignment phone ${assignment.retailerPhone}`);
    phones.add(assignment.retailerPhone);
  }
  return { file: parsed.file, assignments };
}

export function parseClientUatSource(input: ClientUatSourceBuffers, options: { expectedRetailerCount?: number } = {}): ClientUatSource {
  const expectedRetailerCount = options.expectedRetailerCount ?? 30;
  const productResult = parseProducts(input.products);
  const pricingResult = parsePricing(input.pricing, productResult.products);
  const retailerResult = parseRetailers(input.retailers);
  const assignmentResult = parseAssignments(input.assignments);
  if (expectedRetailerCount != null && retailerResult.retailers.length !== expectedRetailerCount) throw new ClientUatSourceError("retailer_count_mismatch", `Expected ${expectedRetailerCount} retailers, found ${retailerResult.retailers.length}`);
  if (retailerResult.retailers.length !== assignmentResult.assignments.length) throw new ClientUatSourceError("assignment_count_mismatch", "Retailer and assignment row counts differ");
  const retailerPhones = new Set(retailerResult.retailers.map((retailer) => retailer.phone));
  for (const assignment of assignmentResult.assignments) if (!retailerPhones.has(assignment.retailerPhone)) throw new ClientUatSourceError("assignment_retailer_missing", `Assignment phone ${assignment.retailerPhone} is not in the retailer workbook`);
  const assignmentPhones = new Set(assignmentResult.assignments.map((assignment) => assignment.retailerPhone));
  for (const retailer of retailerResult.retailers) if (!assignmentPhones.has(retailer.phone)) throw new ClientUatSourceError("retailer_assignment_missing", `Retailer phone ${retailer.phone} is not in the assignment workbook`);
  const salespersonRefs = new Set([...retailerResult.retailers.map((retailer) => retailer.salespersonEmployeeRef), ...assignmentResult.assignments.map((assignment) => assignment.salespersonEmployeeRef)]);
  if (salespersonRefs.size !== 1 || !salespersonRefs.has("SALES-001")) throw new ClientUatSourceError("salesperson_reference_mismatch", `Expected only SALES-001, found ${[...salespersonRefs].join(", ")}`);
  const pricingKeys = new Set(pricingResult.pricing.map((price) => price.canonicalKey));
  const productKeys = new Set(productResult.products.map((product) => product.canonicalKey));
  for (const key of productKeys) if (!pricingKeys.has(key)) throw new ClientUatSourceError("product_price_missing", `No final price was supplied for ${key}`);
  for (const key of pricingKeys) if (!productKeys.has(key)) throw new ClientUatSourceError("price_product_missing", `Pricing supplied for unknown product ${key}`);
  const sources = { products: productResult.file, pricing: pricingResult.file, retailers: retailerResult.file, assignments: assignmentResult.file };
  return {
    sources,
    products: productResult.products,
    pricing: pricingResult.pricing,
    retailers: retailerResult.retailers,
    assignments: assignmentResult.assignments,
    duplicates: [...productResult.duplicates, ...pricingResult.duplicates],
    conflicts: [...productResult.conflicts, ...pricingResult.conflicts],
    pricingBasis: "INR/kg",
    counts: {
      rawProductRows: productResult.file.rawRowCount,
      rawPricingRows: pricingResult.file.rawRowCount,
      rawRetailerRows: retailerResult.file.rawRowCount,
      rawAssignmentRows: assignmentResult.file.rawRowCount,
      canonicalSkuCount: productResult.products.length,
      duplicatesCollapsed: productResult.file.rawRowCount - productResult.products.length,
      pricingConflictsResolved: pricingResult.conflicts.filter((conflict) => conflict.sourceType === "pricing").length,
    },
  };
}

export async function loadClientUatSource(paths: ClientUatSourcePaths, options: { expectedRetailerCount?: number } = {}): Promise<ClientUatSource> {
  const entries = await Promise.all((Object.entries(paths) as Array<[ClientUatSourceType, string]>).map(async ([type, filePath]) => [type, { filename: path.basename(filePath), buffer: await fs.readFile(filePath) }] as const));
  return parseClientUatSource(Object.fromEntries(entries) as ClientUatSourceBuffers, options);
}
