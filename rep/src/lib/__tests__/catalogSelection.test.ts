import { describe, expect, it } from "vitest";
import { catalogGroups, selectedCatalogSku, type CatalogGroup } from "../catalogSelection";
const group: CatalogGroup = { id: "logical", name: "Dal", category: "Daal", skus: [
  { id: "one", unitSize: "1 kg", unitsPerCase: 30, price: 3000 },
  { id: "five", unitSize: "5 kg", unitsPerCase: 6, price: 3100 },
] };
describe("server-owned SKU grouping", () => {
  it("prefers the authoritative grouping over duplicated raw products", () => {
    expect(catalogGroups({ groups: [group], catalog: [{ id: "old" }] })).toEqual([group]);
  });
  it("does not invent cross-product grouping for an older API", () => {
    expect(catalogGroups({ catalog: [{ id: "a", variants: group.skus.slice(0, 1) }, { id: "b", variants: group.skus.slice(1) }] })).toHaveLength(2);
  });
  it("switching packs does not mutate or merge separate cart quantities", () => {
    const quantities: Record<string, number> = { one: 2, five: 3 };
    const qtyFor = (id: string) => quantities[id] ?? 0;
    expect(selectedCatalogSku(group, "five", qtyFor).id).toBe("five");
    expect(selectedCatalogSku(group, "one", qtyFor).id).toBe("one");
    expect(quantities).toEqual({ one: 2, five: 3 });
  });
  it("retains a selected sold-out pack for removal and reconciles vanished selections", () => {
    expect(selectedCatalogSku(group, "five", () => 0).id).toBe("five");
    expect(selectedCatalogSku(group, "deleted", id => id === "one" ? 2 : 0).id).toBe("one");
    expect(catalogGroups({ catalog: [{ id: "empty", variants: [] }] })).toEqual([]);
  });
});
