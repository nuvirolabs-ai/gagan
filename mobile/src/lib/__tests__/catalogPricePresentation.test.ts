import { describe, expect, it } from "vitest";
import { catalogPricePresentation } from "../catalogPricePresentation";

describe("catalog price presentation", () => {
  it("shows a quintal rate and display-only kg and master-pack equivalents", () => {
    expect(catalogPricePresentation({
      price: 1620,
      commercialRate: 5400,
      rateBasis: "quintal",
      caseWeightKg: 30,
    })).toEqual({
      primary: "₹5,400 / quintal",
      perKg: "₹54 / kg",
      caseEquivalent: "₹1,620 / 30 KG case",
    });
  });

  it("does not invent a pack equivalent when weight is missing", () => {
    expect(catalogPricePresentation({ price: 5400, commercialRate: 5400, rateBasis: "quintal" }))
      .toEqual({ primary: "₹5,400 / quintal", perKg: "₹54 / kg", caseEquivalent: null });
  });

  it.each([
    ["Gagan Broken 30 kg", 5400, 30, "₹54 / kg", "₹1,620 / 30 KG case"],
    ["Gagan Choice 30 kg", 8100, 30, "₹81 / kg", "₹2,430 / 30 KG case"],
    ["Gagan Classic 30 kg", 9550, 30, "₹95.5 / kg", "₹2,865 / 30 KG case"],
    ["Gagan Classic 1 kg × 20", 9950, 20, "₹99.5 / kg", "₹1,990 / 20 KG case"],
    ["Gagan Classic 5 kg × 4", 9950, 20, "₹99.5 / kg", "₹1,990 / 20 KG case"],
    ["Gagan Classic 10 kg × 4", 9750, 40, "₹97.5 / kg", "₹3,900 / 40 KG case"],
  ])("presents approved six-variant pricing without changing its quintal rate: %s", (_name, rate, weight, perKg, pack) => {
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

  it("preserves legacy case-price presentation", () => {
    expect(catalogPricePresentation({ price: 2500 }))
      .toEqual({ primary: "₹2,500 / case", perKg: null, caseEquivalent: null });
  });
});
