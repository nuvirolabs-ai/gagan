import { describe, expect, it } from "vitest";
import { buildDraftPack, caseWeightKg, humanizePackFailure, massPreview, parseStoredPack } from "./draftPackForm";

describe("draft pack form", () => {
  it("keeps the unit written on a stored pack such as 30 KG", () => {
    expect(parseStoredPack("30 KG", "kg")).toEqual({ packSize: "30", unit: "kg" });
    expect(parseStoredPack("500 g", "kg")).toEqual({ packSize: "500", unit: "g" });
  });

  it.each([
    ["1", "kg", "30", "1 kg", 1, 30],
    ["500", "g", "20", "500 g", 0.5, 10],
    ["5", "kg", "6", "5 kg", 5, 30],
    ["30", "kg", "1", "30 kg", 30, 30],
    ["1", "quintal", "1", "1 quintal", 100, 100],
  ])("derives %s %s × %s", (packSize, unit, unitsPerCase, unitSize, unitWeightKg, caseWeight) => {
    const built = buildDraftPack({ packSize, unit, unitsPerCase });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.pack).toEqual({ unitSize, unit, unitsPerCase: Number(unitsPerCase), unitWeightKg });
    expect(caseWeightKg(built.pack.unitWeightKg, built.pack.unitsPerCase)).toBe(caseWeight);
  });

  it("explains derived mass in operator language", () => {
    expect(massPreview("1", "kg")?.sentence).toBe("For a 1 kg pack, weight per unit is 1 kg.");
    expect(massPreview("500", "g")?.sentence).toBe("500 g equals 0.5 kg per unit.");
  });

  it("rejects zero, negative, fractional case counts, and unsupported units before submission", () => {
    expect(buildDraftPack({ packSize: "0", unit: "kg", unitsPerCase: "30" }).ok).toBe(false);
    expect(buildDraftPack({ packSize: "-1", unit: "kg", unitsPerCase: "30" })).toMatchObject({ ok: false, fields: { packSize: "Enter a pack size greater than zero." } });
    expect(buildDraftPack({ packSize: "1", unit: "kg", unitsPerCase: "1.5" })).toMatchObject({ ok: false, fields: { unitsPerCase: "Units per case must be a whole number." } });
    expect(buildDraftPack({ packSize: "1", unit: "lb", unitsPerCase: "1" })).toMatchObject({ ok: false, fields: { unit: "Choose kg, g, quintal, or pcs." } });
  });

  it("requires an explicit measured weight for piece packs", () => {
    expect(buildDraftPack({ packSize: "6", unit: "pcs", unitsPerCase: "12" })).toMatchObject({ ok: false, fields: { weight: "Enter the measured weight per piece in kg." } });
    expect(buildDraftPack({ packSize: "6", unit: "pcs", unitsPerCase: "12", measuredWeightKg: "0.25" })).toMatchObject({
      ok: true,
      pack: { unitSize: "6 pcs", unit: "pcs", unitsPerCase: 12, unitWeightKg: 0.25 },
    });
  });

  it("translates invalid_pack into a field message", () => {
    const readable = humanizePackFailure({ error: "invalid_pack", details: [{ index: 0, error: "unitSize must be a quantity in kg, g, quintal or pcs matching unit." }] });
    expect(readable.message).toBe("Enter a pack size greater than zero.");
    expect(readable.message).not.toContain("invalid_pack");
    expect(readable.fields.packSize).toBe("Enter a pack size greater than zero.");
  });
});
