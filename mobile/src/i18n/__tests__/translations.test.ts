import { describe, expect, it } from "vitest";
import { translate } from "../translations";

describe("retailer translations", () => {
  it("returns Hindi text for a known key", () => {
    expect(translate("hi", "language.chooseTitle")).toBe("भाषा चुनें");
  });

  it("falls back to English when a Hindi key is absent", () => {
    expect(translate("hi", "common.help")).toBe("Help");
  });

  it("interpolates variables without translating business data", () => {
    expect(translate("hi", "cart.itemCount", { count: 2 })).toBe("2 आइटम");
  });
});
