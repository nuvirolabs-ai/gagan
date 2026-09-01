import { describe, expect, it } from "vitest";
import {
  commonProductName,
  groupCatalog,
  groupContainingSku,
  groupingKeyFor,
  normalisedSize,
  type GroupableProduct,
} from "../catalogGrouping";

const variant = (id: string, unitSize: string, unitsPerCase: number, price: number | null, caseWeightKg?: number) => ({
  id,
  unitSize,
  unit: "kg",
  unitsPerCase,
  price,
  caseWeightKg,
});

/** The shape the seeded catalogue actually has: packs as separate products. */
const toorDal: GroupableProduct[] = [
  {
    id: "p1",
    name: "Gagan Toor Dal | 1 KG",
    category: "Daal",
    imageUrl: "/img/1kg.png",
    description: "Pure toor dal.",
    sapMaterialId: "SAP-MAT-TOOR",
    variants: [variant("v1", "1 kg", 30, 3150, 30)],
  },
  {
    id: "p2",
    name: "Gagan Toor Dal | 5 KG",
    category: "Daal",
    imageUrl: "/img/5kg.png",
    description: null,
    sapMaterialId: "SAP-MAT-TOOR",
    variants: [variant("v2", "5 kg", 6, 3160, 30)],
  },
  {
    id: "p3",
    name: "Gagan Toor Dal | 30 KG",
    category: "Daal",
    imageUrl: null,
    description: "Bulk pack.",
    sapMaterialId: "SAP-MAT-TOOR",
    variants: [variant("v3", "30 kg", 1, 3170, 30)],
  },
];

describe("what may be grouped", () => {
  it("keys on the ERP material within a category", () => {
    expect(groupingKeyFor(toorDal[0])).toBe("material:Daal:SAP-MAT-TOOR");
  });

  it("never groups a product that has no ERP material", () => {
    expect(groupingKeyFor({ ...toorDal[0], sapMaterialId: null })).toBe("product:p1");
    expect(groupingKeyFor({ ...toorDal[0], sapMaterialId: "   " })).toBe("product:p1");
  });

  it("keeps the same material in different categories apart", () => {
    expect(groupingKeyFor(toorDal[0])).not.toBe(
      groupingKeyFor({ ...toorDal[0], category: "Rice" })
    );
  });
});

describe("naming a grouped card", () => {
  it("uses the stem the pack names share", () => {
    expect(
      commonProductName(["Gagan Toor Dal | 1 KG", "Gagan Toor Dal | 5 KG", "Gagan Toor Dal | 30 KG"])
    ).toBe("Gagan Toor Dal");
  });

  it("leaves a single product's name alone", () => {
    expect(commonProductName(["Basmati Rice"])).toBe("Basmati Rice");
  });

  it("falls back to a real name rather than showing a fragment", () => {
    expect(commonProductName(["Sugar 1kg", "Table Salt"])).toBe("Sugar 1kg");
  });

  it("handles names with no shared stem at all", () => {
    expect(commonProductName(["Alpha", "Beta"])).toBe("Beta");
  });
});

describe("grouping the catalogue", () => {
  it("folds three pack products into one card with three SKUs", () => {
    const groups = groupCatalog(toorDal);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      name: "Gagan Toor Dal",
      category: "Daal",
      hasMultiplePacks: true,
      productIds: ["p1", "p2", "p3"],
    });
    expect(groups[0].skus.map((sku) => sku.packLabel)).toEqual(["1 kg", "5 kg", "30 kg"]);
  });

  it("keeps the SKU as the order unit on every option", () => {
    const [group] = groupCatalog(toorDal);
    // Each option still carries its own variant id and its own product id.
    expect(group.skus.map((sku) => [sku.id, sku.productId])).toEqual([
      ["v1", "p1"],
      ["v2", "p2"],
      ["v3", "p3"],
    ]);
  });

  it("prices each SKU separately", () => {
    const [group] = groupCatalog(toorDal);
    expect(group.skus.map((sku) => sku.price)).toEqual([3150, 3160, 3170]);
  });

  it("also handles a product that already holds several variants", () => {
    const groups = groupCatalog([
      {
        id: "p9",
        name: "Gagan Oil",
        category: "Oil",
        imageUrl: null,
        description: null,
        sapMaterialId: "SAP-MAT-OIL",
        variants: [
          variant("v9a", "1 L", 12, 1800),
          variant("v9b", "500 ml", 24, 1900),
          variant("v9c", "5 L", 4, 3400),
        ],
      },
    ]);
    expect(groups[0].name).toBe("Gagan Oil");
    expect(groups[0].skus.map((sku) => sku.packLabel)).toEqual(["500 ml", "1 L", "5 L"]);
  });

  it("does not merge genuinely different products", () => {
    const groups = groupCatalog([
      ...toorDal,
      {
        id: "p4",
        name: "Basmati Rice",
        category: "Rice",
        imageUrl: null,
        description: null,
        sapMaterialId: "SAP-MAT-BASM",
        variants: [variant("v4", "1 kg", 12, 5400)],
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.name).sort()).toEqual(["Basmati Rice", "Gagan Toor Dal"]);
  });

  it("marks a single-pack product as having no choice to make", () => {
    const [group] = groupCatalog([
      {
        id: "p4",
        name: "Basmati Rice",
        category: "Rice",
        imageUrl: null,
        description: null,
        sapMaterialId: "SAP-MAT-BASM",
        variants: [variant("v4", "1 kg", 12, 5400)],
      },
    ]);
    expect(group.hasMultiplePacks).toBe(false);
    expect(group.skus).toHaveLength(1);
  });

  it("carries imagery and copy from whichever member has them", () => {
    const [group] = groupCatalog(toorDal);
    expect(group.imageUrl).toBe("/img/1kg.png");
    expect(group.description).toBe("Pure toor dal.");
  });

  it("shows the case composition on the detail label", () => {
    const [group] = groupCatalog(toorDal);
    expect(group.skus[0].packDetail).toBe("1 kg × 30");
    // A single-unit case does not need the "× 1".
    expect(group.skus[2].packDetail).toBe("30 kg");
  });

  it("produces a stable card id across calls", () => {
    expect(groupCatalog(toorDal)[0].id).toBe(groupCatalog([...toorDal].reverse())[0].id);
  });

  it("handles an empty catalogue", () => {
    expect(groupCatalog([])).toEqual([]);
  });
});

describe("comparing pack sizes", () => {
  it("scales sub-units so half a litre is smaller than a litre", () => {
    expect(normalisedSize("500 ml")).toBeLessThan(normalisedSize("1 L")!);
    expect(normalisedSize("250 g")).toBeLessThan(normalisedSize("1 kg")!);
  });

  it("reads a size with no space", () => {
    expect(normalisedSize("500ml")).toBe(0.5);
  });

  it("has no size for an unparseable label", () => {
    expect(normalisedSize("assorted")).toBeNull();
  });
});

describe("finding the card a SKU sits on", () => {
  it("locates a variant however it was grouped", () => {
    const groups = groupCatalog(toorDal);
    expect(groupContainingSku(groups, "v2")?.name).toBe("Gagan Toor Dal");
  });

  it("returns nothing for a SKU that is not in the catalogue", () => {
    expect(groupContainingSku(groupCatalog(toorDal), "nope")).toBeNull();
  });
});
