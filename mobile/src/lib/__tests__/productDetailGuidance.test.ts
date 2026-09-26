// @ts-expect-error Vitest executes this test in Node without app-level Node types.
import { readFileSync } from "node:fs";
// @ts-expect-error Vitest executes this test in Node without app-level Node types.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { configuredPositiveAmount } from "../productDetailGuidance";

describe("product detail guidance", () => {
  it("shows only configured positive order and delivery thresholds", () => {
    expect(configuredPositiveAmount(0)).toBeNull();
    expect(configuredPositiveAmount(null)).toBeNull();
    expect(configuredPositiveAmount(undefined)).toBeNull();
    expect(configuredPositiveAmount(-10)).toBeNull();
    expect(configuredPositiveAmount("not a number")).toBeNull();
    expect(configuredPositiveAmount(3000)).toBe(3000);
    expect(configuredPositiveAmount("2500")).toBe(2500);
  });

  it("renders the GST-exclusion note once", () => {
    const source = readFileSync(fileURLToPath(new URL("../../screens/ProductDetailScreen.tsx", import.meta.url)), "utf8");
    expect(source.match(/<Text style=\{styles\.rateLabel\}>Excluding GST<\/Text>/g)).toHaveLength(1);
  });

  it("does not promise included delivery before the manager quote", () => {
    const source = readFileSync(fileURLToPath(new URL("../../screens/CartScreen.tsx", import.meta.url)), "utf8");
    expect(source).not.toContain('t("cart.deliveryIncluded")');
  });

  it("keeps the complete pack detail inside its variant chip", () => {
    const source = readFileSync(fileURLToPath(new URL("../../screens/ProductDetailScreen.tsx", import.meta.url)), "utf8");
    expect(source).toMatch(/numberOfLines=\{1\}[\s\S]*?adjustsFontSizeToFit[\s\S]*?minimumFontScale=\{0\.75\}[\s\S]*?styles\.variantSub/);
    expect(source).toMatch(/variant: \{[\s\S]*?minWidth: 108/);
  });
});
