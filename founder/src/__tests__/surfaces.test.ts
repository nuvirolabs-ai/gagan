import { describe, expect, it } from "vitest";
import { formatAge, formatDue } from "../format/age";
import { formatInrExecutive } from "../format/inr";
import { DEFAULT_PREFERENCES, schemeFrom } from "../settings/preferences";
import { impactLabel } from "../format/impact";
import { tokensFor } from "../theme";

describe("founder surface helpers", () => {
  it("formats long INR and issue impact without wrapping units", () => {
    expect(formatInrExecutive(127_800_000)).toBe("₹12.78Cr");
    expect(impactLabel({ businessImpact: { amount: 78_000, unit: "inr" } })).toBe("₹78,000");
  });

  it("keeps dark tokens semantic rather than inverted", () => {
    const dark = tokensFor("dark");
    expect(dark.canvas).toBe("#0C0E12");
    expect(dark.positive).toBe("#3DDC97");
    expect(dark.negative).toBe("#FF6B6B");
    expect(dark.warning).toBe("#F5C542");
    expect(schemeFrom("system", "dark")).toBe("dark");
    expect(schemeFrom("light", "dark")).toBe("light");
    expect(DEFAULT_PREFERENCES.defaultPeriod).toBe("30D");
  });

  it("formats age and due without leaking timestamps", () => {
    expect(formatAge(5)).toBe("5h");
    expect(formatAge(48)).toBe("2d");
    expect(formatDue(null)).toBe("");
  });
});
