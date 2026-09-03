import { describe, expect, it } from "vitest";
import { compactInr, deltaTone, formatDelta, periodChip } from "../format";

describe("compactInr", () => {
  it("formats lakh and crore the way the board mocks do", () => {
    expect(compactInr(4_260_000)).toBe("₹42.6L");
    expect(compactInr(3_940_000)).toBe("₹39.4L");
    expect(compactInr(18_400_000)).toBe("₹1.84Cr");
    expect(compactInr(78_000)).toBe("₹78k");
  });
});

describe("deltas", () => {
  it("renders D/W/M chips including flat and em dash", () => {
    expect(periodChip("D", "pct", 6.1, 1)).toBe("D +6.1%");
    expect(periodChip("W", "flat", null)).toBe("W flat");
    expect(periodChip("M", "none", null)).toBe("M —");
    expect(formatDelta("pp", -2)).toBe("-2pp");
    expect(deltaTone("pct", -2)).toBe("down");
    expect(deltaTone("flat", 0)).toBe("muted");
  });
});
