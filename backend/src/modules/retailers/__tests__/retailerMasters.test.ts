import { describe, expect, it } from "vitest";
import { INDORE_BEATS, INDORE_BUYER_CATEGORIES, INDORE_GROUPS, INDORE_TRANSPORTERS } from "../retailerMasters";

describe("Indore retailer masters", () => {
  it("seeds realistic Indore groups, transporters, beats and buyer categories", () => {
    expect(INDORE_GROUPS).toEqual(expect.arrayContaining(["Kirana Independent", "Wholesale Kirana", "Modern Trade"]));
    expect(INDORE_TRANSPORTERS).toEqual(expect.arrayContaining(["VRL Logistics Indore", "Local Tempo Palasia"]));
    expect(INDORE_BEATS.map((beat) => beat.name)).toEqual(
      expect.arrayContaining(["Palasia / New Palasia", "Vijay Nagar", "Sanwer Road Mandi"])
    );
    expect(INDORE_BEATS.every((beat) => beat.city === "Indore")).toBe(true);
    expect(INDORE_BUYER_CATEGORIES.map((item) => item.name)).toEqual(
      expect.arrayContaining(["Retailer", "Wholesaler", "HORECA"])
    );
    expect(INDORE_BUYER_CATEGORIES.find((item) => item.name === "Retailer")?.subCategories).toContain("Kirana");
  });
});
