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
    expect(translate("en", "home.schemeAway", { amount: "₹3,200" })).toBe(
      "You're ₹3,200 away from this week's benefit."
    );
  });

  it("explains whether an order is punched or officially created", () => {
    expect(translate("en", "orders.lifecycle.punched")).toBe("Order punched · awaiting approval");
    expect(translate("en", "orders.lifecycle.created")).toBe("Official order created");
    expect(translate("hi", "orders.lifecycle.punched")).toBe("ऑर्डर दर्ज हुआ · अनुमोदन बाकी");
    expect(translate("hi", "orders.lifecycle.created")).toBe("आधिकारिक ऑर्डर बनाया गया");
  });
});
