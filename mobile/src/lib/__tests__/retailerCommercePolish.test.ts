// The mobile app deliberately does not include Node types in its app tsconfig;
// these imports are only used by this structural source-order regression test.
// @ts-expect-error Vitest executes this test in Node without app-level Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest executes this test in Node without app-level Node types.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { HomeProductGroup } from "../../types/home";
import { buildRetailerPromotions } from "../retailerPromotions";
import { shouldShowMiniCart } from "../miniCartVisibility";
import { MINI_CART_SPACE, TAB_BAR_SPACE, tabBarContentSpace } from "../../theme";
import { HOME_PRODUCT_PREVIEW_LIMIT, homeProductPreview } from "../homeProductPreview";

const homeScreenSource = readFileSync(
  fileURLToPath(new URL("../../screens/HomeScreen.tsx", import.meta.url)),
  "utf8"
);

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

  it("keeps Home shopping-first and reserves the full floating-footer inset", () => {
    const markers = [
      "<RetailerPromoCarousel",
      "{/* Account finance */}",
      "{/* Shop by category */}",
      "{/* Products */}",
      "{/* Latest order */}",
      "{/* Order again */}",
    ];
    const positions = markers.map((marker) => homeScreenSource.indexOf(marker));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(tabBarContentSpace(2)).toBe(TAB_BAR_SPACE + MINI_CART_SPACE);
    expect(homeScreenSource).not.toContain("shelf.map((group)");
  });
  it("bounds only Home's product preview while retaining the complete catalogue", () => {
    const all = Array.from({ length: 52 }, (_, index) => group({ id: `p-${index}` }));
    expect(HOME_PRODUCT_PREVIEW_LIMIT).toBeLessThan(52);
    expect(homeProductPreview(all)).toHaveLength(HOME_PRODUCT_PREVIEW_LIMIT);
    expect(all).toHaveLength(52);
  });
  it("active tab re-tap scrolls the existing Home and Products views", () => {
    const catalog = readFileSync(fileURLToPath(new URL("../../screens/CatalogScreen.tsx", import.meta.url)), "utf8");
    expect(homeScreenSource).toContain("useScrollToTop(scrollRef)");
    expect(catalog).toContain("useScrollToTop(listRef)");
  });
  it("marks retained account totals as possibly stale when Home refresh fails", () => {
    expect(homeScreenSource).toContain('setFinanceStale(true)');
    expect(homeScreenSource).toContain('setFinanceStale(false)');
    expect(homeScreenSource).toContain('Account totals may be out of date');
  });
});
