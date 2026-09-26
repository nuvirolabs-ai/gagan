import { describe, expect, it } from "vitest";
import { translate } from "../../i18n/translations";

describe("financial reconciliation copy", () => {
  it("renders a clear warning in English and Hindi", () => {
    expect(translate("en", "finance.reviewTitle")).toBe("Account balance under review");
    expect(translate("en", "finance.reviewBody")).toContain("Do not collect");
    expect(translate("hi", "finance.reviewTitle")).toContain("समीक्षा");
    expect(translate("hi", "finance.reviewBody")).toContain("वसूली");
  });
});
