import { describe, expect, it } from "vitest";
import { assertCommercialInvoiceable, calculateCommercialQuote, CommercialQuoteLine, hasPendingGst, ManagerFreight } from "../lib/commercialQuote";

const line: CommercialQuoteLine = {
  variantId: "test-sku", entity: "jain_traders", cases: 2, caseWeightKg: "30",
  rate: "1000", rateBasis: "quintal", gstPercent: "5",
};
const freight: ManagerFreight = {
  entity: "jain_traders", amount: "120", recordedQuintals: "0.6", recordedKilometres: "50", gstPercent: "0",
};

describe("commercial quote foundation", () => {
  it("creates an explicitly pre-tax quote when a line is approved for pending GST", () => {
    const quote = calculateCommercialQuote({ lines: [{ ...line, gstPercent: null }] });
    expect(quote.gstPending).toBe(true);
    expect(quote.lines[0]).toMatchObject({ gstPercent: null, gstPending: true, base: "600.00", gst: "0.00", total: "600.00" });
    expect(quote.total).toBe("600.00");
    expect(hasPendingGst(quote)).toBe(true);
    expect(() => assertCommercialInvoiceable(quote)).toThrow("GST configuration required before invoice");
  });

  it("converts accepted case weight to quintals and adds explicit SKU GST", () => {
    const quote = calculateCommercialQuote({ lines: [line] });
    expect(quote.lines[0]).toMatchObject({ quintals: "0.6", base: "600.00", gst: "30.00", total: "630.00" });
  });
  it("adds the manager's final amount without multiplying distance or weight", () => {
    const first = calculateCommercialQuote({ lines: [line], freight });
    const second = calculateCommercialQuote({ lines: [line], freight: { ...freight, recordedQuintals: "100", recordedKilometres: "500" } });
    expect(first.total).toBe("750.00");
    expect(second.total).toBe(first.total);
  });
  it("keeps mixed-company and different-tax SKU totals attributable", () => {
    const quote = calculateCommercialQuote({ lines: [line, {
      ...line, variantId: "test-padam", entity: "padam_international", cases: 1, rateBasis: "case", rate: "200", gstPercent: "12",
    }], freight });
    expect(quote.entities).toEqual([
      { entity: "jain_traders", goods: "600.00", freight: "120.00", gst: "30.00", total: "750.00" },
      { entity: "padam_international", goods: "200.00", freight: "0.00", gst: "24.00", total: "224.00" },
    ]);
    expect(quote.total).toBe("974.00");
  });
  it("does not infer freight tax from product tax", () => {
    expect(calculateCommercialQuote({ lines: [line], freight: { ...freight, gstPercent: "18" } }).total).toBe("771.60");
    expect(() => calculateCommercialQuote({ lines: [line], freight: { ...freight, gstPercent: undefined as unknown as string } })).toThrow("GST");
  });
  it("rejects an unowned freight charge and duplicate SKU", () => {
    expect(() => calculateCommercialQuote({ lines: [line], freight: { ...freight, entity: "padam_international" } })).toThrow("Freight entity");
    expect(() => calculateCommercialQuote({ lines: [line, line] })).toThrow("Duplicate");
  });
  it.each(["-1", "NaN", "Infinity", "1.001"])("rejects invalid final freight %s", amount => {
    expect(() => calculateCommercialQuote({ lines: [line], freight: { ...freight, amount } })).toThrow();
  });
  it("uses decimal half-up rounding without floating point loss", () => {
    const quote = calculateCommercialQuote({ lines: [{ ...line, cases: 1, caseWeightKg: "50", rate: "2.01", gstPercent: "0" }] });
    expect(quote.total).toBe("1.01");
  });
});
