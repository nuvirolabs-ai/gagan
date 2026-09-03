import * as XLSX from "xlsx";
import { allHeaders, IMPORT_DEFINITIONS, type ImportType } from "./importDefinitions";

export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export type RawImportRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export class ImportParseError extends Error {
  constructor(public readonly code: string, public readonly details?: Record<string, unknown>) {
    super(code);
  }
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function extension(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match?.[1].toLowerCase();
}

export function parseImportFile(buffer: Buffer, fileName: string, type: ImportType): {
  headers: string[];
  rows: RawImportRow[];
} {
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new ImportParseError("file_too_large", { maxBytes: MAX_IMPORT_BYTES });
  }
  const ext = extension(fileName);
  if (ext !== "csv" && ext !== "xlsx") {
    throw new ImportParseError("unsupported_file_type", { supported: ["csv", "xlsx"] });
  }

  let sheet: XLSX.WorkSheet;
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error("missing_sheet");
    sheet = workbook.Sheets[firstSheet];
  } catch {
    throw new ImportParseError("file_not_readable");
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new ImportParseError("too_many_rows", { maxRows: MAX_IMPORT_ROWS });
  }
  const expected = new Set(allHeaders(type));
  const rawHeaders = rawRows.length ? Object.keys(rawRows[0]) : [];
  const headers = rawHeaders.map(normalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  const unknownHeaders = headers.filter((header) => header && !expected.has(header));
  const missingHeaders = IMPORT_DEFINITIONS[type].required.filter((header) => !headers.includes(header));
  if (duplicateHeaders.length || unknownHeaders.length || missingHeaders.length) {
    throw new ImportParseError("invalid_headers", {
      duplicateHeaders: [...new Set(duplicateHeaders)],
      unknownHeaders: [...new Set(unknownHeaders)],
      missingHeaders,
      allowedHeaders: [...expected],
    });
  }
  const rows = rawRows.map((raw, index) => {
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) values[normalizeHeader(key)] = String(value ?? "").trim();
    return { rowNumber: index + 2, values };
  });
  return { headers, rows };
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "row_number,reason\n";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n") + "\n";
}

