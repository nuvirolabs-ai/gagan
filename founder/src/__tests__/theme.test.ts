import { describe, expect, it } from "vitest";
import { contrastRatio, tokensFor } from "../theme";

describe("founder tokens", () => {
  it("keep graphite text readable on the canvas in both schemes", () => {
    const light = tokensFor("light");
    const dark = tokensFor("dark");
    expect(contrastRatio(light.label, light.canvas)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(dark.label, dark.canvas)).toBeGreaterThanOrEqual(7);
    expect(light.positive).not.toBe(light.warning);
    expect(dark.canvas).toBe("#000000");
  });

  it("does not use gold or brand green as a decorative fill", () => {
    const light = tokensFor("light");
    expect(light.canvas).toBe("#F5F4F1");
    expect(light.positive).toBe("#248A3D");
  });
});
