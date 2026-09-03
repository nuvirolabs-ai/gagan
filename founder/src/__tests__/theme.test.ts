import { describe, expect, it } from "vitest";
import { contrastRatio, tokensFor } from "../theme";

describe("founder tokens", () => {
  it("keep Quiet Instrument ink readable on the dark canvas", () => {
    const light = tokensFor("light");
    const dark = tokensFor("dark");
    expect(contrastRatio(light.label, light.canvas)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(dark.label, dark.canvas)).toBeGreaterThanOrEqual(7);
    expect(light.positive).not.toBe(light.warning);
    expect(dark.canvas).toBe("#0C0E12");
  });

  it("locks Quiet Instrument rather than light iOS Founders canvas", () => {
    const light = tokensFor("light");
    expect(light.canvas).toBe("#0C0E12");
    expect(light.positive).toBe("#3DDC97");
    expect(light.negative).toBe("#FF6B6B");
    expect(light.info).toBe("#7AA2FF");
  });
});
