import { describe, expect, it } from "vitest";
import { translate } from "../translations";

describe("salesperson translations", () => {
  it("returns Hindi text for a known key", () => {
    expect(translate("hi", "language.chooseTitle")).toBe("भाषा चुनें");
  });

  it("falls back to English when a Hindi key is absent", () => {
    expect(translate("hi", "common.help")).toBe("Help");
  });

  it("translates retailer form labels", () => {
    expect(translate("hi", "retailerForm.partyName")).toBe("पार्टी नाम");
    expect(translate("en", "retailerForm.aadhaarPhoto")).toBe("Aadhaar Card Photo");
  });

  it("exposes Ocean Home IA labels", () => {
    expect(translate("en", "tabs.attendance")).toBe("Attendance");
    expect(translate("en", "tabs.order")).toBe("Order");
    expect(translate("en", "tabs.stock")).toBe("Stock");
    expect(translate("en", "tabs.more")).toBe("More");
    expect(translate("en", "home.startVisit")).toBe("Start visit");
    expect(translate("hi", "tabs.attendance")).toBe("हाजिरी");
  });
});
