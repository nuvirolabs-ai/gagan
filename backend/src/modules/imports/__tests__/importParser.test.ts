import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseImportFile } from "../importParser";
import { errorCsv } from "../importService";

describe("data import parser", () => {
  it("reads the published CSV headers and trims values", () => {
    const result = parseImportFile(
      Buffer.from("name,phone,shop_address,tier\n  Sunrise Stores ,9812345678,Market Road,Standard\n"),
      "retailers.csv",
      "retailers"
    );
    expect(result.headers).toEqual(["name", "phone", "shop_address", "tier"]);
    expect(result.rows).toEqual([{ rowNumber: 2, values: { name: "Sunrise Stores", phone: "9812345678", shop_address: "Market Road", tier: "Standard" } }]);
  });

  it("reads XLSX and bounds large files before a database apply", () => {
    const workbook = XLSX.utils.book_new();
    const rows = Array.from({ length: 10_000 }, (_, index) => ({ name: `Store ${index}`, phone: `98${String(index).padStart(8, "0")}`, shop_address: "Market Road", tier: "Standard" }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Import");
    const result = parseImportFile(Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })), "retailers.xlsx", "retailers");
    expect(result.rows).toHaveLength(10_000);
    expect(result.rows.at(-1)?.rowNumber).toBe(10_001);
  });

  it("rejects unsupported headers instead of silently dropping columns", () => {
    expect(() => parseImportFile(Buffer.from("name,phone,shop_address,tier,secret\nA,9812345678,Road,Standard,nope\n"), "retailers.csv", "retailers")).toThrow("invalid_headers");
  });

  it("exports blocked preview rows before apply", async () => {
    const db = { importJob: { findUnique: async () => ({ id: "job-1", fileName: "retailers.csv", result: { phase: "preview" }, preview: { rows: [{ rowNumber: 2, action: "blocked", errors: ["phone invalid"], values: { name: "QA" } }] } }) } } as any;
    const result = await errorCsv(db, "job-1");
    expect(result.csv).toContainEqual(expect.objectContaining({ row_number: 2, reason: "phone invalid", name: "QA" }));
  });
});
