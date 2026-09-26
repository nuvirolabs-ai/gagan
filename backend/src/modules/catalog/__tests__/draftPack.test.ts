import { describe, expect, it } from "vitest";
import { validateDraftPack } from "../draftPack";

describe("draft pack validation", () => {
  it.each([
    ["1 kg", "kg", 1],
    ["500 g", "g", 0.5],
    ["1 quintal", "quintal", 100],
    ["250 gm", "g", 0.25],
    ["1.005 kg", "kg", 1.005],
  ])("accepts explicit mass %s", (unitSize, unit, unitWeightKg) => {
    expect(validateDraftPack({ unitSize, unit, unitsPerCase: 2, unitWeightKg })).toEqual({
      errors: [], countOnly: false,
    });
  });

  it("keeps explicitly weighed pieces draft-only", () => {
    expect(validateDraftPack({ unitSize: "6 pcs", unit: "pcs", unitsPerCase: 12, unitWeightKg: 0.25 })).toEqual({
      errors: [], countOnly: true,
    });
  });

  it("accepts a count label without inferring its weight", () => {
    expect(validateDraftPack({ unitSize: "1 piece", unit: "pcs", unitsPerCase: 12, unitWeightKg: 0.25 })).toEqual({ errors: [], countOnly: true });
  });

  it("rejects inferred, mismatched and unrepresentable weights", () => {
    expect(validateDraftPack({ unitSize: "500 g", unit: "g", unitsPerCase: 12, unitWeightKg: 1 }).errors).toContain("unitWeightKg must equal the mass in unitSize.");
    expect(validateDraftPack({ unitSize: "1 pcs", unit: "pcs", unitsPerCase: 12, unitWeightKg: 0 }).errors).toContain("unitWeightKg must be explicitly positive.");
    expect(validateDraftPack({ unitSize: "250 mg", unit: "mg", unitsPerCase: 12, unitWeightKg: 0.00025 }).errors.length).toBeGreaterThan(0);
    expect(validateDraftPack({ unitSize: "1.5 pcs", unit: "pcs", unitsPerCase: 12, unitWeightKg: 0.25 }).errors).toContain("Piece count must be a positive whole number.");
    expect(validateDraftPack({ unitSize: "1 kg", unit: "kg", unitsPerCase: 2147483648, unitWeightKg: 1 }).errors).toContain("unitsPerCase must be a positive whole number.");
  });
});
