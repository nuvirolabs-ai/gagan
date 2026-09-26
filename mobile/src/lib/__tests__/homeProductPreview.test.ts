// @ts-expect-error Vitest executes this test in Node without app-level Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest executes this test in Node without app-level Node types.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { HomeProductGroup, HomeSku } from "../../types/home";
import { HOME_PRODUCT_PREVIEW_LIMIT, homeProductPreview } from "../homeProductPreview";

const homeScreenSource = readFileSync(
  fileURLToPath(new URL("../../screens/HomeScreen.tsx", import.meta.url)),
  "utf8"
);

function group(index: number, packs: number): HomeProductGroup {
  const id = `product-${index}`;
  const skus = Array.from({ length: packs }, (_, pack): HomeSku => ({
    id: `${id}-variant-${pack}`,
    productId: id,
    productName: id,
    packLabel: `${pack + 1} kg`,
    packDetail: `${pack + 1} kg`,
    unitSize: String(pack + 1),
    unit: "kg",
    unitsPerCase: 1,
    price: 100,
  }));
  return {
    id,
    name: id,
    category: "Staples",
    imageUrl: index === 2 ? "/featured.jpg" : null,
    description: null,
    productIds: [id],
    skus,
    hasMultiplePacks: packs > 1,
  };
}

describe("Retailer Home product preview", () => {
  it("shows at most 20 actual variants across featured and shelf, including a partial last group", () => {
    const all = [group(2, 3), ...Array.from({ length: 19 }, (_, index) => group(index + 3, 2))];

    const preview = homeProductPreview(all);

    expect(HOME_PRODUCT_PREVIEW_LIMIT).toBe(20);
    expect(preview.groups.flatMap((item) => item.skus)).toHaveLength(20);
    expect(preview.groups[0].id).toBe("product-2");
    expect(preview.groups.at(-1)?.skus).toHaveLength(1);
    expect(preview.hasMore).toBe(true);
    expect(all[9].skus).toHaveLength(2);
  });

  it("keeps all variants when fewer than 20 are available", () => {
    const preview = homeProductPreview([group(1, 2), group(2, 3)]);
    expect(preview.groups.flatMap((item) => item.skus)).toHaveLength(5);
    expect(preview.hasMore).toBe(false);
  });

  it("caps one oversized group without changing the original catalogue data", () => {
    const oversized = group(1, 24);
    const preview = homeProductPreview([oversized]);

    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].skus).toHaveLength(20);
    expect(preview.hasMore).toBe(true);
    expect(oversized.skus).toHaveLength(24);
    expect(homeProductPreview([group(1, 20)]).hasMore).toBe(false);
  });

  it("offers View All Products after the capped preview and opens the full Products screen", () => {
    const previewEnd = homeScreenSource.indexOf("{previewGroups.slice(1).map");
    const action = homeScreenSource.indexOf("{hasMoreProducts ? (", previewEnd);
    const actionEnd = homeScreenSource.indexOf("</TouchableOpacity>", action);

    expect(homeScreenSource).toContain("homeProductPreview([...(featured ? [featured] : []), ...shelf])");
    expect(previewEnd).toBeGreaterThan(0);
    expect(action).toBeGreaterThan(previewEnd);
    expect(homeScreenSource.slice(action, actionEnd)).toContain('navigation.navigate("Products")');
    expect(homeScreenSource.slice(action, actionEnd)).toContain('{t("home.viewProducts")} {t("tabs.products")}');
  });
});
