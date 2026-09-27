import { describe, expect, it } from "vitest";
import { filterCollectionRetailers } from "./collectionRetailerSearch";

const retailers = [
  { id: "1", name: "Kirana Mart", phone: "9812345678", shopAddress: "Pune Road" },
  { id: "2", name: "City Foods", phone: "9123456780", shopAddress: "Market Lane" },
];

describe("collection retailer search", () => {
  it("shows all assigned retailers for an empty query", () => {
    expect(filterCollectionRetailers(retailers, " ")).toEqual(retailers);
  });

  it("matches name, phone, and address without case sensitivity", () => {
    expect(filterCollectionRetailers(retailers, " KIRANA ").map((r) => r.id)).toEqual(["1"]);
    expect(filterCollectionRetailers(retailers, "912345").map((r) => r.id)).toEqual(["2"]);
    expect(filterCollectionRetailers(retailers, "pune").map((r) => r.id)).toEqual(["1"]);
  });

  it("does not introduce retailers outside the assigned list", () => {
    expect(filterCollectionRetailers(retailers, "unknown")).toEqual([]);
  });
});
