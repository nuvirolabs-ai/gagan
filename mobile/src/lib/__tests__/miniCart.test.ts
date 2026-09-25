import { describe, expect, it } from "vitest";
import type { CartLine } from "../../types";
import { getMiniCartModel } from "../miniCart";
import {
  MINI_CART_SPACE,
  TAB_BAR_SPACE,
  tabBarContentSpace,
  retailerTabBarMetrics,
} from "../../theme";

const line = (variantId: string, qty: number, unitPrice: number): CartLine => ({
  variantId,
  productName: variantId,
  packSize: "1 kg × 30",
  unitPrice,
  qty,
});

describe("live mini-cart model", () => {
  it("hides for an empty cart", () => {
    expect(getMiniCartModel([], 0)).toEqual({
      visible: false,
      itemCount: 0,
      subtotal: 0,
      amountLabel: "Catalogue subtotal",
    });
  });

  it("uses the existing cart lines and total without turning subtotal into payable total", () => {
    expect(getMiniCartModel([line("a", 2, 1200), line("b", 1, 800)], 3200)).toEqual({
      visible: true,
      itemCount: 3,
      subtotal: 3200,
      amountLabel: "Catalogue subtotal",
    });
  });

  it("updates immediately when a line is incremented, decremented, or removed", () => {
    const lines = [line("a", 3, 1000), line("b", 2, 500)];
    expect(getMiniCartModel(lines, 4000).itemCount).toBe(5);
    expect(getMiniCartModel([{ ...lines[0], qty: 2 }, lines[1]], 3500).itemCount).toBe(4);
    expect(getMiniCartModel([], 0).visible).toBe(false);
  });

  it("reserves extra tab-bar space only while the mini-cart is visible", () => {
    expect(tabBarContentSpace(0)).toBe(TAB_BAR_SPACE);
    expect(tabBarContentSpace(1)).toBe(TAB_BAR_SPACE + MINI_CART_SPACE);
  });

  it("reserves the live system inset and visual gap for the floating tab bar", () => {
    const expected = [
      { itemCount: 0, inset: 0, paddingBottom: 8, contentSpace: 72 },
      { itemCount: 0, inset: 16, paddingBottom: 24, contentSpace: 88 },
      { itemCount: 0, inset: 24, paddingBottom: 32, contentSpace: 96 },
      { itemCount: 0, inset: 48, paddingBottom: 56, contentSpace: 120 },
      { itemCount: 1, inset: 24, paddingBottom: 32, contentSpace: 168 },
    ];

    for (const item of expected) {
      expect(retailerTabBarMetrics(item.itemCount, item.inset)).toEqual({
        paddingBottom: item.paddingBottom,
        contentSpace: item.contentSpace,
      });
    }
  });
});
