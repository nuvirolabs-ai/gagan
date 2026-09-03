import { describe, expect, it } from "vitest";
import { formatDelta, formatInrExecutive, formatMetricValue } from "../format/inr";

describe("INR executive formatting", () => {
  it("uses lakh and crore consistently", () => {
    expect(formatInrExecutive(4_820_000)).toBe("₹48.2L");
    expect(formatInrExecutive(14_200_000)).toBe("₹1.42Cr");
    expect(formatInrExecutive(127_800_000)).toBe("₹12.78Cr");
    expect(formatInrExecutive(12_500)).toBe("₹12,500");
    expect(formatInrExecutive(100_000)).toBe("₹1L");
  });

  it("formats deltas without mixing units", () => {
    expect(formatDelta(210_000, "inr", "down")).toBe("↓ ₹2.1L");
    expect(formatDelta(3, "points", "down")).toBe("↓ 3 pts");
    expect(formatMetricValue(91, "percent")).toBe("91%");
  });
});
