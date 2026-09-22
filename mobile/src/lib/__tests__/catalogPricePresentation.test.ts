import { describe, expect, it } from "vitest";
import { catalogPricePresentation } from "../catalogPricePresentation";

describe("catalogue price basis", () => {
  it.each([
    [5400, 30, 1620, "₹54 / kg"],
    [8100, 30, 2430, "₹81 / kg"],
    [9550, 30, 2865, "₹95.5 / kg"],
    [9950, 20, 1990, "₹99.5 / kg"],
    [9750, 40, 3900, "₹97.5 / kg"],
  ])("keeps %s/quintal separate from its case equivalent", (rate, weight, price, perKg) => {
    const sku = Object.freeze({ commercialRate: rate, rateBasis: "quintal", caseWeightKg: weight, price });
    const value = catalogPricePresentation(sku);
    expect(value.primary).toBe(`₹${rate.toLocaleString("en-IN")} / quintal`);
    expect(value.perKg).toBe(perKg);
    expect(value.caseEquivalent).toBe(`₹${price.toLocaleString("en-IN")} / ${weight} KG case`);
    expect(sku.commercialRate).toBe(rate);
  });

  it("does not invent a pack conversion when weight is absent", () => {
    expect(catalogPricePresentation({ commercialRate: 5400, rateBasis: "quintal", price: null }).caseEquivalent).toBeNull();
  });

  it("preserves the legacy case-price contract", () => {
    expect(catalogPricePresentation({ price: 3120, caseWeightKg: 30 })).toEqual({ primary: "₹3,120 / case", perKg: "₹104 / kg", caseEquivalent: null });
  });
});
