import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { normalizeIndianPhone } from "../identity/otpService";
import { HierarchyService } from "../org/hierarchyService";
import { nextQuarterlyCheckpoint } from "../credit/reviewSchedule";
import { upsertInventorySnapshot } from "../inventory/inventoryService";
import { IMPORT_DEFINITIONS, IMPORT_TYPES, type ImportMode, type ImportType } from "./importDefinitions";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseImportFile, rowsToCsv, type RawImportRow } from "./importParser";

type Db = PrismaClient | Prisma.TransactionClient;
type JsonObject = Record<string, unknown>;

export type PreparedRow = {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
  warnings: string[];
  action: "create" | "update" | "blocked";
  match?: { id: string; label: string };
  resolved?: JsonObject;
};

export class ImportServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 400, public readonly details?: unknown) {
    super(code);
  }
}

const importTypeSet = new Set<string>(IMPORT_TYPES);

export function isImportType(value: unknown): value is ImportType {
  return typeof value === "string" && importTypeSet.has(value);
}

export function allowedModes(type: ImportType): ImportMode[] {
  return type === "assignments" || type === "sap_mappings"
    ? ["upsert"]
    : ["upsert", "create_only", "update_only"];
}

function text(values: Record<string, string>, key: string) {
  return values[key]?.trim() ?? "";
}

function numberValue(values: Record<string, string>, key: string) {
  const raw = text(values, key).replace(/[₹,\s]/g, "");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function dateValue(values: Record<string, string>, key: string) {
  const raw = text(values, key);
  if (!raw) return new Date();
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
}

function lower(value: string) {
  return value.trim().toLowerCase();
}

function withMode(row: PreparedRow, mode: ImportMode) {
  if (row.action === "blocked") return;
  if (mode === "create_only" && row.action === "update") row.errors.push("A matching record already exists (create-only mode).");
  if (mode === "update_only" && row.action === "create") row.errors.push("No matching record exists (update-only mode).");
  if (row.errors.length) row.action = "blocked";
}

function resultRow(row: RawImportRow): PreparedRow {
  return { rowNumber: row.rowNumber, values: row.values, errors: [], warnings: [], action: "create" };
}

async function context(db: Db) {
  const [tiers, retailers, staff, products, inventory, prices] = await Promise.all([
    db.tier.findMany({ select: { id: true, name: true } }),
    db.retailer.findMany({ select: { id: true, name: true, phone: true, salesRepId: true, sapCustomerId: true } }),
    db.staffUser.findMany({ select: { id: true, name: true, employeeRef: true, phone: true, email: true, salesRepId: true } }),
    db.product.findMany({ include: { variants: true }, orderBy: { createdAt: "asc" } }),
    db.inventorySnapshot.findMany({ select: { id: true, productId: true, variantId: true, sapMaterialId: true, warehouseCode: true } }),
    db.priceList.findMany({ select: { id: true, tierId: true, variantId: true } }),
  ]);
  return { tiers, retailers, staff, products, inventory, prices };
}

function productMatch(ctx: Awaited<ReturnType<typeof context>>, name: string, unitSize: string, sapMaterialId?: string) {
  const product = sapMaterialId
    ? ctx.products.find((item) => item.sapMaterialId && lower(item.sapMaterialId) === lower(sapMaterialId))
    : ctx.products.find((item) => lower(item.name) === lower(name));
  if (!product) return null;
  const variant = product.variants.find((item) => lower(item.unitSize) === lower(unitSize));
  return { product, variant };
}

function addRequired(row: PreparedRow, keys: string[]) {
  for (const key of keys) if (!text(row.values, key)) row.errors.push(`${key} is required.`);
}

export async function validateRows(db: Db, type: ImportType, rawRows: RawImportRow[], mode: ImportMode) {
  const ctx = await context(db);
  const prepared = rawRows.map(resultRow);
  const employeeRefsInFile = new Set(rawRows.map((row) => lower(text(row.values, "employee_ref"))).filter(Boolean));
  const seen = new Set<string>();

  for (const row of prepared) {
    const values = row.values;
    switch (type) {
      case "retailers": {
        addRequired(row, IMPORT_DEFINITIONS[type].required);
        let phone = "";
        try { phone = normalizeIndianPhone(text(values, "phone")); } catch { row.errors.push("phone must be a valid Indian phone number."); }
        if (phone && seen.has(phone)) row.errors.push("Duplicate phone in this file.");
        if (phone) seen.add(phone);
        const tier = ctx.tiers.find((item) => lower(item.name) === lower(text(values, "tier")));
        if (!tier && text(values, "tier")) row.errors.push("tier does not match an existing Gagan tier.");
        const salesperson = text(values, "salesperson_employee_ref")
          ? ctx.staff.find((item) => lower(item.employeeRef ?? "") === lower(text(values, "salesperson_employee_ref")))
          : null;
        if (text(values, "salesperson_employee_ref") && !salesperson?.salesRepId) row.errors.push("salesperson_employee_ref must match an existing salesperson.");
        const creditLimit = text(values, "credit_limit") ? numberValue(values, "credit_limit") : 0;
        if (creditLimit === null || creditLimit < 0) row.errors.push("credit_limit must be a non-negative number.");
        const existing = phone ? ctx.retailers.find((item) => item.phone === phone) : null;
        row.action = existing ? "update" : "create";
        if (existing) row.match = { id: existing.id, label: existing.name };
        row.resolved = { phone, tierId: tier?.id, salesRepId: salesperson?.salesRepId ?? null, existingId: existing?.id ?? null };
        break;
      }
      case "products": {
        addRequired(row, IMPORT_DEFINITIONS[type].required);
        const unitsPerCase = numberValue(values, "units_per_case");
        const unitWeightKg = numberValue(values, "unit_weight_kg");
        if (unitsPerCase === null || !Number.isInteger(unitsPerCase) || unitsPerCase <= 0) row.errors.push("units_per_case must be a positive whole number.");
        if (unitWeightKg === null || unitWeightKg <= 0) row.errors.push("unit_weight_kg must be positive.");
        if (text(values, "image_url")) {
          try { const url = new URL(text(values, "image_url")); if (!/^https?:$/.test(url.protocol)) throw new Error(); } catch { row.errors.push("image_url must be an http(s) URL."); }
        }
        const match = productMatch(ctx, text(values, "product_name"), text(values, "unit_size"), text(values, "sap_material_id"));
        row.action = match?.variant ? "update" : "create";
        if (match?.variant) row.match = { id: match.variant.id, label: `${match.product.name} / ${match.variant.unitSize}` };
        row.resolved = { productId: match?.product.id ?? null, variantId: match?.variant?.id ?? null };
        break;
      }
      case "salespeople": {
        addRequired(row, IMPORT_DEFINITIONS[type].required);
        let phone = "";
        try { phone = normalizeIndianPhone(text(values, "phone")); } catch { row.errors.push("phone must be a valid Indian phone number."); }
        if (text(values, "status") && !["active", "suspended", "revoked"].includes(lower(text(values, "status")))) row.errors.push("status must be active, suspended, or revoked.");
        if (phone && seen.has(phone)) row.errors.push("Duplicate phone in this file.");
        if (phone) seen.add(phone);
        const existing = ctx.staff.find((item) =>
          (text(values, "employee_ref") && lower(item.employeeRef ?? "") === lower(text(values, "employee_ref"))) ||
          (phone && item.phone === phone) || lower(item.email) === lower(text(values, "email"))
        );
        const managerRef = text(values, "manager_employee_ref");
        if (managerRef && !ctx.staff.some((item) => lower(item.employeeRef ?? "") === lower(managerRef)) && !employeeRefsInFile.has(lower(managerRef))) row.errors.push("manager_employee_ref does not match an existing or imported employee.");
        row.action = existing ? "update" : "create";
        if (existing) row.match = { id: existing.id, label: existing.name };
        row.resolved = { phone, existingId: existing?.id ?? null };
        break;
      }
      case "assignments": {
        addRequired(row, IMPORT_DEFINITIONS[type].required);
        let phone = "";
        try { phone = normalizeIndianPhone(text(values, "retailer_phone")); } catch { row.errors.push("retailer_phone must be a valid Indian phone number."); }
        const retailer = ctx.retailers.find((item) => item.phone === phone);
        const staff = ctx.staff.find((item) => lower(item.employeeRef ?? "") === lower(text(values, "salesperson_employee_ref")) && item.salesRepId);
        if (!retailer) row.errors.push("retailer_phone does not match an existing retailer.");
        if (!staff) row.errors.push("salesperson_employee_ref does not match an existing salesperson.");
        row.action = retailer?.salesRepId === staff?.salesRepId ? "update" : "update";
        row.match = retailer ? { id: retailer.id, label: retailer.name } : undefined;
        row.resolved = { retailerId: retailer?.id ?? null, salesRepId: staff?.salesRepId ?? null };
        break;
      }
      case "inventory": {
        addRequired(row, IMPORT_DEFINITIONS[type].required);
        const onHand = numberValue(values, "on_hand");
        const committed = text(values, "committed") ? numberValue(values, "committed") : 0;
        if (onHand === null || onHand < 0) row.errors.push("on_hand must be a non-negative number.");
        if (committed === null || committed < 0) row.errors.push("committed must be a non-negative number.");
        if (committed !== null && onHand !== null && committed > onHand) row.warnings.push("committed exceeds on_hand; available will be zero.");
        const match = productMatch(ctx, text(values, "product_name"), text(values, "unit_size"), text(values, "sap_material_id"));
        if (!match?.product) row.errors.push("product_name + unit_size (or sap_material_id) does not match an existing product variant.");
        const existing = ctx.inventory.find((item) => lower(item.sapMaterialId) === lower(text(values, "sap_material_id")) && lower(item.warehouseCode) === lower(text(values, "warehouse_code")));
        row.action = existing ? "update" : "create";
        if (existing) row.match = { id: existing.id, label: `${existing.sapMaterialId} / ${existing.warehouseCode}` };
        row.resolved = { productId: match?.product.id ?? null, variantId: match?.variant?.id ?? null, existingId: existing?.id ?? null };
        break;
      }
      case "pricing": {
        addRequired(row, IMPORT_DEFINITIONS[type].required);
        const price = numberValue(values, "price");
        if (price === null || price < 0) row.errors.push("price must be a non-negative number.");
        const tier = ctx.tiers.find((item) => lower(item.name) === lower(text(values, "tier")));
        const match = productMatch(ctx, text(values, "product_name"), text(values, "unit_size"));
        if (!tier) row.errors.push("tier does not match an existing Gagan tier.");
        if (!match?.variant) row.errors.push("product_name + unit_size does not match an existing product variant.");
        const existing = tier && match?.variant ? ctx.prices.find((item) => item.tierId === tier.id && item.variantId === match.variant!.id) : null;
        row.action = existing ? "update" : "create";
        if (existing) row.match = { id: existing.id, label: `${text(values, "tier")} / ${text(values, "product_name")}` };
        row.resolved = { tierId: tier?.id ?? null, variantId: match?.variant?.id ?? null, existingId: existing?.id ?? null };
        break;
      }
      case "sap_mappings": {
        addRequired(row, IMPORT_DEFINITIONS[type].required);
        const entityType = lower(text(values, "entity_type"));
        const sapCode = text(values, "sap_code");
        if (!["retailer", "product"].includes(entityType)) row.errors.push("entity_type must be retailer or product.");
        if (!sapCode) row.errors.push("sap_code is required.");
        let entity: { id: string; label: string } | null = null;
        if (entityType === "retailer") {
          try { entity = ctx.retailers.map((item) => ({ id: item.id, label: item.name })).find((item) => ctx.retailers.find((r) => r.id === item.id)?.phone === normalizeIndianPhone(text(values, "gagan_key"))) ?? null; } catch { row.errors.push("gagan_key must be an existing retailer phone."); }
        } else if (entityType === "product") {
          const [name, unitSize] = text(values, "gagan_key").split("|").map((part) => part.trim());
          const match = productMatch(ctx, name, unitSize);
          entity = match?.product ? { id: match.product.id, label: `${match.product.name} / ${unitSize}` } : null;
          if (!entity) row.errors.push("product gagan_key must be `Product name|Unit size` for an existing product.");
        }
        if (entity) row.match = entity;
        row.action = "update";
        row.resolved = { entityType, entityId: entity?.id ?? null };
        break;
      }
    }
    withMode(row, mode);
  }
  return prepared;
}

function counts(rows: PreparedRow[]) {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0).length,
    warningRows: rows.filter((row) => row.errors.length === 0 && row.warnings.length > 0).length,
    failedRows: rows.filter((row) => row.errors.length > 0).length,
  };
}

export async function previewImport(db: Db, input: { type: ImportType; fileName: string; buffer: Buffer; mode: ImportMode; actorStaffId: string }) {
  if (input.buffer.byteLength > MAX_IMPORT_BYTES) throw new ImportServiceError("file_too_large", 413);
  const parsed = parseImportFile(input.buffer, input.fileName, input.type);
  if (parsed.rows.length > MAX_IMPORT_ROWS) throw new ImportServiceError("too_many_rows", 413);
  const rows = await validateRows(db, input.type, parsed.rows, input.mode);
  const summary = counts(rows);
  const job = await db.importJob.create({
    data: {
      importType: input.type,
      fileName: input.fileName.slice(0, 255),
      mode: input.mode,
      actorStaffId: input.actorStaffId,
      totalRows: summary.totalRows,
      validRows: summary.validRows,
      warningRows: summary.warningRows,
      failedRows: summary.failedRows,
      preview: { headers: parsed.headers, rawRows: parsed.rows, rows } as Prisma.InputJsonValue,
      result: { phase: "preview", ...summary } as Prisma.InputJsonValue,
    },
  });
  await db.auditEvent.create({
    data: {
      actorStaffId: input.actorStaffId,
      action: "import.preview_created",
      subjectType: "ImportJob",
      subjectId: job.id,
      metadata: { importType: input.type, fileName: input.fileName, ...summary, source: "import" },
    },
  });
  return { job, summary, headers: parsed.headers, rows };
}

async function audit(db: Db, actorStaffId: string, jobId: string, subjectType: string, subjectId: string, action: string, mode: ImportMode) {
  await db.auditEvent.create({ data: { actorStaffId, action, subjectType, subjectId, metadata: { importJobId: jobId, mode, source: "import" } } });
}

async function applyRow(db: PrismaClient, type: ImportType, row: PreparedRow, mode: ImportMode, jobId: string, actorStaffId: string) {
  const v = row.values;
  const resolved = row.resolved ?? {};
  if (type === "retailers") {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.retailer.findUnique({ where: { phone: String(resolved.phone) } });
      if (existing && mode === "create_only") throw new ImportServiceError("already_exists", 409);
      if (!existing && mode === "update_only") throw new ImportServiceError("not_found", 404);
      const data = { name: text(v, "name"), shopAddress: text(v, "shop_address"), tierId: String(resolved.tierId), creditLimit: numberValue(v, "credit_limit") ?? 0, ...(resolved.salesRepId ? { salesRepId: String(resolved.salesRepId) } : {}), ...(text(v, "sap_customer_id") ? { sapCustomerId: text(v, "sap_customer_id") } : {}) };
      if (existing) return { row: await tx.retailer.update({ where: { id: existing.id }, data }), action: "updated" as const };
      const created = await tx.retailer.create({ data: { ...data, phone: String(resolved.phone) } });
      await tx.retailerLocation.create({ data: { retailerId: created.id, status: "NOT_SET", source: "MIGRATION", locationVersion: 0 } });
      await tx.creditProfile.create({ data: { retailerId: created.id, rating: "N", accountCreatedAt: created.createdAt, nextReviewAt: nextQuarterlyCheckpoint(created.createdAt) } });
      return { row: created, action: "created" as const };
    });
    await audit(db, actorStaffId, jobId, "Retailer", result.row.id, "import.retailer_applied", mode);
    return { action: result.action, subjectType: "Retailer", subjectId: result.row.id };
  }
  if (type === "products") {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const product = resolved.productId ? await tx.product.findUnique({ where: { id: String(resolved.productId) } }) : null;
      if (product && mode === "create_only" && resolved.variantId) throw new ImportServiceError("already_exists", 409);
      if (!product && mode === "update_only") throw new ImportServiceError("not_found", 404);
      const productData = { name: text(v, "product_name"), category: text(v, "category"), ...(text(v, "description") ? { description: text(v, "description") } : {}), ...(text(v, "image_url") ? { imageUrl: text(v, "image_url") } : {}), ...(text(v, "sap_material_id") ? { sapMaterialId: text(v, "sap_material_id") } : {}) };
      const target = product ? await tx.product.update({ where: { id: product.id }, data: productData }) : await tx.product.create({ data: productData });
      const variantData = { unitSize: text(v, "unit_size"), unit: text(v, "unit"), unitsPerCase: numberValue(v, "units_per_case")!, unitWeightKg: numberValue(v, "unit_weight_kg")! };
      const variant = resolved.variantId
        ? await tx.variant.update({ where: { id: String(resolved.variantId) }, data: variantData })
        : await tx.variant.create({ data: { ...variantData, productId: target.id } });
      return { target, variant, action: resolved.variantId ? "updated" as const : "created" as const };
    });
    await audit(db, actorStaffId, jobId, "Variant", result.variant.id, "import.product_applied", mode);
    return { action: result.action, subjectType: "Variant", subjectId: result.variant.id };
  }
  if (type === "salespeople") {
    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = resolved.existingId ? await tx.staffUser.findUnique({ where: { id: String(resolved.existingId) } }) : null;
      if (existing && mode === "create_only") throw new ImportServiceError("already_exists", 409);
      if (!existing && mode === "update_only") throw new ImportServiceError("not_found", 404);
      let salesRepId = existing?.salesRepId ?? null;
      if (salesRepId) await tx.salesRep.update({ where: { id: salesRepId }, data: { name: text(v, "name"), phone: String(resolved.phone), territory: text(v, "territory") || null } });
      else salesRepId = (await tx.salesRep.create({ data: { name: text(v, "name"), phone: String(resolved.phone), territory: text(v, "territory") || null } })).id;
      const staff = existing
        ? await tx.staffUser.update({ where: { id: existing.id }, data: { name: text(v, "name"), phone: String(resolved.phone), email: text(v, "email").toLowerCase(), employeeRef: text(v, "employee_ref"), salesRepId, ...(text(v, "status") ? { status: lower(text(v, "status")) as "active" | "suspended" | "revoked" } : {}) } })
        : await tx.staffUser.create({ data: { name: text(v, "name"), phone: String(resolved.phone), email: text(v, "email").toLowerCase(), employeeRef: text(v, "employee_ref"), salesRepId } });
      return { staff, action: existing ? "updated" as const : "created" as const };
    });
    await audit(db, actorStaffId, jobId, "StaffUser", result.staff.id, "import.salesperson_applied", mode);
    return { action: result.action, subjectType: "StaffUser", subjectId: result.staff.id, managerEmployeeRef: text(v, "manager_employee_ref") };
  }
  if (type === "assignments") {
    const retailer = await db.retailer.update({ where: { id: String(resolved.retailerId) }, data: { salesRepId: String(resolved.salesRepId) } });
    await audit(db, actorStaffId, jobId, "Retailer", retailer.id, "import.assignment_applied", mode);
    return { action: "updated" as const, subjectType: "Retailer", subjectId: retailer.id };
  }
  if (type === "inventory") {
    const snapshot = await upsertInventorySnapshot(db, { productId: String(resolved.productId), variantId: resolved.variantId ? String(resolved.variantId) : null, sapMaterialId: text(v, "sap_material_id"), warehouseCode: text(v, "warehouse_code"), onHand: numberValue(v, "on_hand")!, committed: numberValue(v, "committed") ?? 0, syncedAt: dateValue(v, "synced_at")!, source: "import" });
    await audit(db, actorStaffId, jobId, "InventorySnapshot", snapshot.id, "import.inventory_applied", mode);
    return { action: resolved.existingId ? "updated" as const : "created" as const, subjectType: "InventorySnapshot", subjectId: snapshot.id };
  }
  if (type === "pricing") {
    const price = await db.priceList.upsert({ where: { tierId_variantId: { tierId: String(resolved.tierId), variantId: String(resolved.variantId) } }, update: { price: numberValue(v, "price")! }, create: { tierId: String(resolved.tierId), variantId: String(resolved.variantId), productId: (await db.variant.findUnique({ where: { id: String(resolved.variantId) }, select: { productId: true } }))!.productId, price: numberValue(v, "price")! } });
    await audit(db, actorStaffId, jobId, "PriceList", price.id, "import.pricing_applied", mode);
    return { action: resolved.existingId ? "updated" as const : "created" as const, subjectType: "PriceList", subjectId: price.id };
  }
  if (type === "sap_mappings") {
    const entityType = String(resolved.entityType);
    const id = String(resolved.entityId);
    const entity = entityType === "retailer"
      ? await db.retailer.update({ where: { id }, data: { sapCustomerId: text(v, "sap_code") } })
      : await db.product.update({ where: { id }, data: { sapMaterialId: text(v, "sap_code") } });
    await audit(db, actorStaffId, jobId, entityType === "retailer" ? "Retailer" : "Product", id, "import.sap_mapping_applied", mode);
    return { action: "updated" as const, subjectType: entityType === "retailer" ? "Retailer" : "Product", subjectId: entity.id };
  }
  throw new ImportServiceError("unsupported_import_type", 400);
}

export async function applyImport(db: PrismaClient, jobId: string, actorStaffId: string, confirm: boolean) {
  if (!confirm) throw new ImportServiceError("explicit_confirmation_required", 400);
  const job = await db.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new ImportServiceError("import_not_found", 404);
  if (!isImportType(job.importType) || !job.mode || !allowedModes(job.importType).includes(job.mode as ImportMode)) throw new ImportServiceError("invalid_import_job", 409);
  if (!["preview", "completed_with_errors"].includes(job.status)) throw new ImportServiceError("import_not_applyable", 409);
  const mode = job.mode as ImportMode;
  const rawRows = ((job.preview as JsonObject | null)?.rawRows ?? []) as RawImportRow[];
  const rows = await validateRows(db, job.importType, rawRows, mode);
  await db.importJob.update({ where: { id: job.id }, data: { status: "applying", startedAt: new Date(), result: { phase: "applying" } as Prisma.InputJsonValue } });
  const results: JsonObject[] = [];
  for (const row of rows) {
    if (row.errors.length) {
      results.push({ rowNumber: row.rowNumber, status: "failed", values: row.values, errors: row.errors });
      continue;
    }
    try {
      const applied = await applyRow(db, job.importType, row, mode, job.id, actorStaffId);
      results.push({ rowNumber: row.rowNumber, status: applied.action, subjectType: applied.subjectType, subjectId: applied.subjectId, values: row.values });
      if ("managerEmployeeRef" in applied && applied.managerEmployeeRef) results[results.length - 1].managerEmployeeRef = applied.managerEmployeeRef;
    } catch (error) {
      results.push({ rowNumber: row.rowNumber, status: "failed", values: row.values, errors: [error instanceof ImportServiceError ? error.code : "row_apply_failed"] });
    }
  }
  // Manager links are applied after all salesperson identities exist, which
  // permits a single file to contain a manager and their new direct reports.
  if (job.importType === "salespeople") {
    const refToStaff = new Map((await db.staffUser.findMany({ select: { id: true, employeeRef: true } })).map((staff) => [lower(staff.employeeRef ?? ""), staff.id]));
    const hierarchy = new HierarchyService(db);
    for (const result of results) {
      const managerRef = typeof result.managerEmployeeRef === "string" ? result.managerEmployeeRef : "";
      if (!managerRef || result.status === "failed") continue;
      const managerId = refToStaff.get(lower(managerRef));
      if (!managerId) { result.status = "failed"; result.errors = ["manager_not_found_after_apply"]; continue; }
      try { await hierarchy.setManager({ employeeId: String(result.subjectId), managerId, actorStaffId }); }
      catch { result.status = "failed"; result.errors = ["manager_assignment_rejected"]; }
      delete result.managerEmployeeRef;
    }
  }
  const resultCounts = {
    totalRows: results.length,
    createdRows: results.filter((r) => r.status === "created").length,
    updatedRows: results.filter((r) => r.status === "updated").length,
    failedRows: results.filter((r) => r.status === "failed").length,
    skippedRows: 0,
  };
  const status = resultCounts.failedRows ? "completed_with_errors" : "completed";
  const updated = await db.importJob.update({ where: { id: job.id }, data: { status, ...resultCounts, completedAt: new Date(), result: { phase: "complete", ...resultCounts, rows: results } as Prisma.InputJsonValue } });
  await audit(db, actorStaffId, job.id, "ImportJob", job.id, "import.applied", mode);
  return { job: updated, ...resultCounts, errors: results.filter((r) => r.status === "failed") };
}

export async function listImports(db: Db) {
  return db.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, importType: true, fileName: true, status: true, mode: true, totalRows: true, validRows: true, failedRows: true, createdRows: true, updatedRows: true, createdAt: true, completedAt: true } });
}

export async function errorCsv(db: Db, jobId: string) {
  const job = await db.importJob.findUnique({ where: { id: jobId }, select: { id: true, fileName: true, result: true, preview: true } });
  if (!job) throw new ImportServiceError("import_not_found", 404);
  const resultRows = (job.result as JsonObject | null)?.rows;
  const previewRows = (job.preview as JsonObject | null)?.rows;
  const rows = (resultRows ?? previewRows ?? []) as JsonObject[];
  return { fileName: `${job.fileName.replace(/\.[^.]+$/, "")}-errors.csv`, csv: rows.filter((row) => row.status === "failed" || (Array.isArray(row.errors) && row.errors.length > 0)).map((row) => ({ row_number: row.rowNumber, reason: Array.isArray(row.errors) ? row.errors.join("; ") : "Import failed", ...((row.values as JsonObject) ?? {}) })) };
}
