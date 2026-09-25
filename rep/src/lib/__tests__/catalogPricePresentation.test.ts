import { describe, expect, it } from "vitest";
import { catalogPricePresentation } from "../catalogPricePresentation";

describe("Salesperson catalogue price presentation", () => {
  it.each([
    ["Gagan Broken 30 kg", 5400, 30, "₹54 / kg", "₹1,620 / 30 KG case"],
    ["Gagan Choice 30 kg", 8100, 30, "₹81 / kg", "₹2,430 / 30 KG case"],
    ["Gagan Classic 30 kg", 9550, 30, "₹95.5 / kg", "₹2,865 / 30 KG case"],
    ["Gagan Classic 1 kg × 20", 9950, 20, "₹99.5 / kg", "₹1,990 / 20 KG case"],
    ["Gagan Classic 5 kg × 4", 9950, 20, "₹99.5 / kg", "₹1,990 / 20 KG case"],
    ["Gagan Classic 10 kg × 4", 9750, 40, "₹97.5 / kg", "₹3,900 / 40 KG case"],
  ])("shows quintal, kg and pack equivalents for %s", (_name, rate, weight, perKg, pack) => {
    expect(catalogPricePresentation({
      price: Math.round(Number(rate) * Number(weight)) / 100,
      commercialRate: Number(rate),
      rateBasis: "quintal",
      caseWeightKg: Number(weight),
    })).toEqual({
      primary: `₹${Number(rate).toLocaleString("en-IN")} / quintal`,
      perKg,
      caseEquivalent: pack,
    });
  });

  it("preserves ordinary case-price presentation", () => {
    expect(catalogPricePresentation({ price: 2500 }))
      .toEqual({ primary: "₹2,500 / case", perKg: null, caseEquivalent: null });
  });
});
