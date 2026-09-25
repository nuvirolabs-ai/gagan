import express, { Router, type RequestHandler } from "express";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requireAdminIdentity } from "../../lib/adminAuth";
import { requirePermission, type StaffAuthedRequest } from "../../modules/identity/permissions";
import { Permissions } from "../../modules/identity/roleCatalog";
import { IMPORT_DEFINITIONS, IMPORT_TYPES, type ImportMode } from "../../modules/imports/importDefinitions";
import { ImportServiceError, allowedModes, applyImport, errorCsv, isImportType, listImports, previewImport } from "../../modules/imports/importService";
import { rowsToCsv } from "../../modules/imports/importParser";

const router = Router();
const importAccess: RequestHandler = (req, res, next) => {
  const staffReq = req as StaffAuthedRequest;
  const permissions = staffReq.staffAuth?.permissions ?? [];
  if (permissions.includes(Permissions.DATA_IMPORT) || permissions.includes(Permissions.STAFF_MANAGE)) return next();
  return res.status(403).json({ error: "permission_required", permission: Permissions.DATA_IMPORT });
};

router.use(["/imports", "/imports/:id"], requireAdminIdentity, importAccess);

router.get("/imports/types", (_req, res) => {
  res.json({ types: IMPORT_TYPES.map((type) => ({ type, ...IMPORT_DEFINITIONS[type], modes: allowedModes(type) })) });
});

router.get("/imports/templates/:type.:format", (req, res) => {
  if (!isImportType(req.params.type)) return res.status(404).json({ error: "unsupported_import_type" });
  const format = req.params.format.toLowerCase();
  if (format !== "csv" && format !== "xlsx") return res.status(404).json({ error: "unsupported_template_format" });
  const definition = IMPORT_DEFINITIONS[req.params.type];
  const headers = [...definition.required, ...definition.optional];
  const row = Object.fromEntries(headers.map((header) => [header, definition.example[header] ?? ""]));
  const instructionRows = [
    Object.fromEntries(headers.map((header) => [header, definition.required.includes(header) ? "Required" : "Optional"])),
    row,
  ];
  const base = `gagan-${req.params.type}-template`;
  if (format === "csv") {
    res.type("text/csv").setHeader("Content-Disposition", `attachment; filename=\"${base}.csv\"`);
    return res.send(rowsToCsv(instructionRows));
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(instructionRows, { header: headers }), "Import");
  const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").setHeader("Content-Disposition", `attachment; filename=\"${base}.xlsx\"`);
  return res.send(output);
});

router.get("/imports", async (_req, res) => {
  res.json({ imports: await listImports(prisma) });
});

router.get("/imports/:id", async (req, res) => {
  const job = await prisma.importJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "import_not_found" });
  const preview = job.preview as { headers?: string[]; rows?: unknown[] } | null;
  res.json({
    job: {
      id: job.id, importType: job.importType, fileName: job.fileName, status: job.status, mode: job.mode,
      totalRows: job.totalRows, validRows: job.validRows, warningRows: job.warningRows, failedRows: job.failedRows,
      createdRows: job.createdRows, updatedRows: job.updatedRows, skippedRows: job.skippedRows, createdAt: job.createdAt,
      startedAt: job.startedAt, completedAt: job.completedAt, result: job.result,
    },
    headers: preview?.headers ?? [],
    rows: preview?.rows ?? [],
  });
});

router.post("/imports/preview", express.raw({ type: ["application/octet-stream", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], limit: "10mb" }), async (req: StaffAuthedRequest, res) => {
  const type = req.header("x-import-type");
  const fileName = req.header("x-file-name") ?? "import.csv";
  const mode = (req.header("x-import-mode") ?? "upsert") as ImportMode;
  if (!isImportType(type)) return res.status(400).json({ error: "unsupported_import_type" });
  if (!allowedModes(type).includes(mode)) return res.status(400).json({ error: "unsupported_import_mode" });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: "file_body_required" });
  try {
    const result = await previewImport(prisma, { type, fileName, buffer: req.body, mode, actorStaffId: req.staffAuth!.staffId });
    return res.status(201).json({ job: result.job, summary: result.summary, headers: result.headers, rows: result.rows.map(({ resolved: _resolved, ...row }) => row) });
  } catch (error) {
    if (error instanceof ImportServiceError || (error && typeof error === "object" && "code" in error)) {
      const typed = error as { code: string; status?: number; details?: unknown };
      return res.status(typed.status ?? 400).json({ error: typed.code, details: typed.details });
    }
    throw error;
  }
});

router.post("/imports/:id/apply", async (req: StaffAuthedRequest, res) => {
  try {
    const result = await applyImport(prisma, req.params.id, req.staffAuth!.staffId, req.body?.confirm === true);
    return res.json(result);
  } catch (error) {
    if (error instanceof ImportServiceError) return res.status(error.status).json({ error: error.code, details: error.details });
    throw error;
  }
});

router.get("/imports/:id/errors.csv", async (req, res) => {
  const result = await errorCsv(prisma, req.params.id);
  res.type("text/csv").setHeader("Content-Disposition", `attachment; filename=\"${result.fileName}\"`);
  res.send(rowsToCsv(result.csv));
});

export default router;
