import { describe, expect, it } from "vitest";
import type { HomeProductGroup } from "../../types/home";
import { buildRetailerPromotions } from "../retailerPromotions";
import { shouldShowMiniCart } from "../miniCartVisibility";

const group = (overrides: Partial<HomeProductGroup>): HomeProductGroup => ({
  id: overrides.id ?? "group",
  name: overrides.name ?? "Product",
  category: overrides.category ?? "Staples",
  imageUrl: overrides.imageUrl ?? null,
  description: null,
  productIds: [overrides.id ?? "group"],
  skus: [],
  hasMultiplePacks: false,
  ...overrides,
});

describe("approved retailer commerce polish", () => {
  it("keeps exactly three discovery promotions with the approved copy", () => {
    const promotions = buildRetailerPromotions([
      group({ id: "dal", name: "Gagan Toor Dal", category: "Daal", imageUrl: "/dal.jpg" }),
      group({ id: "laxmi", name: "Laxmi Toor Dal", category: "Daal", imageUrl: "/laxmi.jpg" }),
      group({ id: "rice", name: "Gagan Basmati Rice", category: "Rice", imageUrl: "/rice.jpg" }),
    ]);

    expect(promotions).toHaveLength(3);
    expect(promotions.map(({ id }) => id)).toEqual([
      "dal-range",
      "laxmi-toor-dal",
      "rice-whole-grains",
    ]);
    expect(promotions.map(({ title, detail, cta }) => ({ title, detail, cta }))).toEqual([
      { title: "Stock your best sellers", detail: "Popular dals for everyday demand", cta: "Explore Dals" },
      { title: "Laxmi Toor Dal", detail: "A trusted everyday essential", cta: "View Range" },
      { title: "Rice & whole grains", detail: "Everyday staples for your store", cta: "Explore Range" },
    ]);
  });

  it("shows the live mini-cart only on discovery surfaces", () => {
    expect(shouldShowMiniCart("Home")).toBe(true);
    expect(shouldShowMiniCart("Products")).toBe(true);
    expect(shouldShowMiniCart("ProductDetail")).toBe(true);
    expect(shouldShowMiniCart("Cart")).toBe(false);
    expect(shouldShowMiniCart("Review")).toBe(false);
    expect(shouldShowMiniCart("Checkout")).toBe(false);
    expect(shouldShowMiniCart("OrderDetail")).toBe(false);
  });
});
