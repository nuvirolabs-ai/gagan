import { describe, expect, it } from "vitest";
import type { HomeProductGroup } from "../../types/home";
import { buildRetailerPromotions, promotionDestination } from "../retailerPromotions";

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

describe("retailer home promotions", () => {
  it("builds the three approved cards in the stable order with real catalogue images", () => {
    const promotions = buildRetailerPromotions([
      group({ id: "rice", name: "Gagan Basmati Rice", category: "Rice", imageUrl: "/rice.jpg" }),
      group({ id: "laxmi", name: "Laxmi Toor Dal", category: "Daal", imageUrl: "/laxmi.jpg" }),
      group({ id: "dal", name: "Gagan Toor Dal", category: "Daal", imageUrl: "/dal.jpg" }),
    ]);

    expect(promotions).toHaveLength(3);
    expect(promotions.map((item) => item.id)).toEqual(["dal-range", "laxmi-toor-dal", "rice-whole-grains"]);
    expect(promotions.map((item) => item.category)).toEqual(["Daal", "Daal", "Rice"]);
    expect(promotions.map((item) => item.imageUrl)).toEqual(["/dal.jpg", "/laxmi.jpg", "/rice.jpg"]);
    expect(promotions.map((item) => item.cta)).toEqual(["View Dals", "Shop Laxmi", "Explore Range"]);
  });

  it("uses a category treatment when no exact catalogue image is available", () => {
    const promotions = buildRetailerPromotions([
      group({ id: "dal", name: "Gagan Toor Dal", category: "Daal" }),
      group({ id: "rice", name: "Basmati Rice", category: "Rice" }),
    ]);

    expect(promotions[0].imageUrl).toBeNull();
    expect(promotions[0].imageTreatment).toBe("category");
  });

  it("points each CTA to the existing Products screen and its category", () => {
    expect(promotionDestination({ category: "Daal" })).toEqual({
      screen: "Products",
      params: { category: "Daal" },
    });
  });
});
