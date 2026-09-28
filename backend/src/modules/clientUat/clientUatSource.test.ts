import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { clientUatCanonicalKey, ClientUatSourceError, parseClientUatSource } from "./clientUatSource";

function workbook(headers: string[], rows: unknown[][], commentColumn?: number) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ["Required", ...headers.slice(1).map(() => "Optional")], ...rows]);
  if (commentColumn != null) sheet[XLSX.utils.encode_cell({ r: 0, c: commentColumn })].c = [{ a: "test", t: "Price/kg" }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Import");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

function sources(overrides: Partial<Record<"products" | "pricing" | "retailers" | "assignments", Buffer>> = {}) {
  return {
    products: { filename: "products.xlsx", buffer: overrides.products ?? workbook(["product_name", "category", "unit_size", "unit", "units_per_case", "unit_weight_kg", "description", "image_url", "sap_material_id"], [
      ["Gagan Rice", "Rice", "1 KG", "kg", 30, 1, "old", "https://example.invalid/rice.jpg", "MAT-IMPORT-001"],
      ["Gagan Rice", "Rice", "1 KG", "kg", 30, 1, "last row", "", ""],
      ["Neel Gagan Dal", "Dal", "500 GM", "gm", 40, 0.5, "dal", "", ""],
    ]) },
    pricing: { filename: "pricing.xlsx", buffer: overrides.pricing ?? workbook(["tier", "product_name", "unit_size", "price", "units_per_case", "variant_id"], [
      ["Gold", "Gagan Rice", "1 KG", 54, 30, "v1"],
      ["", "Gagan Rice", "1 KG", 55, 30, "v2"],
      ["", "Neel Gagan Dal", "500 GM", 80, 40, "v3"],
    ], 3) },
    retailers: { filename: "retailers.xlsx", buffer: overrides.retailers ?? workbook(["name", "phone", "shop_address", "salesperson_employee_ref", "sap_customer_id"], [
      ["One Store", "+91 99999 99999", "A", "SALES-001", ""],
      ["Two Store", "8888888888", "B", "SALES-001", ""],
    ]) },
    assignments: { filename: "assignments.xlsx", buffer: overrides.assignments ?? workbook(["retailer_phone", "salesperson_employee_ref"], [
      ["9999999999", "SALES-001"],
      ["8888888888", "SALES-001"],
    ]) },
  };
}

describe("client UAT source normalization", () => {
  it("records source rows, collapses duplicates, ignores unsafe template metadata, and converts INR/kg to case price", () => {
    const source = parseClientUatSource(sources(), { expectedRetailerCount: 2 });
    expect(source.counts).toMatchObject({ rawProductRows: 3, rawPricingRows: 3, rawRetailerRows: 2, rawAssignmentRows: 2, canonicalSkuCount: 2, duplicatesCollapsed: 1, pricingConflictsResolved: 1 });
    expect(source.pricing[0]).toMatchObject({ pricePerKg: 55, casePrice: 1650, rowNumber: 4 });
    expect(source.products[0]).toMatchObject({ description: "last row", imageUrl: null, sapMaterialId: null, rowNumber: 4 });
    expect(source.pricingBasis).toBe("INR/kg");
    expect(source.conflicts.some((conflict) => conflict.sourceType === "pricing" && conflict.chosenRow === 4)).toBe(true);
    expect(source.retailers[0].phone).toBe("9999999999");
  });

  it("uses the complete canonical pack identity, including unit and unit weight", () => {
    expect(clientUatCanonicalKey({ productName: "A", unitSize: "1 KG", unit: "kg", unitsPerCase: 30, unitWeightKg: 1 })).not.toBe(
      clientUatCanonicalKey({ productName: "A", unitSize: "1 KG", unit: "gm", unitsPerCase: 30, unitWeightKg: 1 })
    );
  });

  it("rejects a pricing workbook without the Price/kg source comment", () => {
    const input = sources();
    input.pricing = { filename: "pricing.xlsx", buffer: workbook(["tier", "product_name", "unit_size", "price", "units_per_case"], [["", "Gagan Rice", "1 KG", 54, 30]]) };
    expect(() => parseClientUatSource(input, { expectedRetailerCount: 2 })).toThrowError(ClientUatSourceError);
    expect(() => parseClientUatSource(input, { expectedRetailerCount: 2 })).toThrow(/Price\/kg/);
  });

  it("rejects retailer and assignment cross-sheet drift", () => {
    const input = sources();
    input.assignments = { filename: "assignments.xlsx", buffer: workbook(["retailer_phone", "salesperson_employee_ref"], [["7777777777", "SALES-001"], ["8888888888", "SALES-001"]]) };
    expect(() => parseClientUatSource(input, { expectedRetailerCount: 2 })).toThrow(/not in the retailer workbook/);
  });
});
