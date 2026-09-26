export type DraftPack = {
  unitSize: string;
  unit: string;
  unitsPerCase: number;
  unitWeightKg: number;
};

const massKg: Record<string, number> = { kg: 1, g: 0.001, quintal: 100 };
const canonicalUnit: Record<string, string> = {
  kg: "kg", kgs: "kg", g: "g", gm: "g", grams: "g",
  quintal: "quintal", qtl: "quintal",
  pcs: "pcs", pc: "pcs", piece: "pcs", pieces: "pcs",
};

export function validateDraftPack(pack: DraftPack): { errors: string[]; countOnly: boolean } {
  const errors: string[] = [];
  const unit = canonicalUnit[pack.unit.trim().toLowerCase()];
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*(kg|kgs|g|gm|grams|quintal|qtl|pcs|pc|piece|pieces)$/i.exec(pack.unitSize.trim());
  const sizeUnit = match ? canonicalUnit[match[2].toLowerCase()] : undefined;
  const countOnly = sizeUnit === "pcs";

  if (!match || (sizeUnit !== unit && !(unit === "kg" && sizeUnit === "g"))) {
    errors.push("unitSize must be a quantity in kg, g, quintal or pcs matching unit.");
  }
  if (!Number.isSafeInteger(pack.unitsPerCase) || pack.unitsPerCase <= 0 || pack.unitsPerCase > 2147483647) {
    errors.push("unitsPerCase must be a positive whole number.");
  }
  if (!Number.isFinite(pack.unitWeightKg) || pack.unitWeightKg <= 0) {
    errors.push("unitWeightKg must be explicitly positive.");
  } else if (!/^\d+(?:\.\d{1,3})?$/.test(String(pack.unitWeightKg)) || pack.unitWeightKg > 9999999.999) {
    errors.push("unitWeightKg must fit three decimal places.");
  }
  if (match && (!Number.isFinite(Number(match[1])) || Number(match[1]) <= 0)) errors.push("unitSize must be positive.");
  if (countOnly && match && !Number.isSafeInteger(Number(match[1]))) errors.push("Piece count must be a positive whole number.");
  if (sizeUnit && sizeUnit !== "pcs" && massKg[sizeUnit] && Number.isFinite(pack.unitWeightKg)) {
    const expected = Number(match![1]) * massKg[sizeUnit];
    if (Math.abs(expected - pack.unitWeightKg) > 1e-9) errors.push("unitWeightKg must equal the mass in unitSize.");
  }
  return { errors, countOnly };
}
