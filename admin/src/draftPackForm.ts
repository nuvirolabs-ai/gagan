export type DraftPackPayload = {
  unitSize: string;
  unit: string;
  unitsPerCase: number;
  unitWeightKg: number;
};

export type DraftPackFields = {
  packSize?: string;
  unit?: string;
  unitsPerCase?: string;
  weight?: string;
  imageUrl?: string;
};

const CANONICAL: Record<string, string> = {
  kg: "kg",
  kgs: "kg",
  g: "g",
  gm: "g",
  grams: "g",
  quintal: "quintal",
  qtl: "quintal",
  pcs: "pcs",
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
};

const MASS_TO_KG: Record<string, number> = { kg: 1, g: 0.001, quintal: 100 };

export function canonicalUnit(unit: string) {
  return CANONICAL[unit.trim().toLowerCase()];
}

export function parseStoredPack(unitSize: string, unit: string) {
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*([a-z]+)?$/i.exec(unitSize.trim());
  const fromSize = match?.[2] ? canonicalUnit(match[2]) : undefined;
  const fromUnit = canonicalUnit(unit);
  return {
    packSize: match?.[1] ?? "",
    unit: fromSize ?? fromUnit ?? "kg",
  };
}

function formatAmount(value: number) {
  return String(Number(value.toFixed(6)));
}

function massKilograms(size: number, unit: string) {
  const factor = MASS_TO_KG[unit];
  if (!factor) return null;
  const weight = size * factor;
  const rounded = Math.round(weight * 1000) / 1000;
  if (!Number.isFinite(weight) || weight <= 0 || Math.abs(rounded - weight) > 1e-9) return null;
  if (!/^\d+(?:\.\d{1,3})?$/.test(String(rounded)) || rounded > 9999999.999) return null;
  return rounded;
}

export function massPreview(packSize: string, unit: string) {
  const canonical = canonicalUnit(unit);
  const size = Number(packSize);
  if (!canonical || canonical === "pcs" || !Number.isFinite(size) || size <= 0) return null;
  const unitWeightKg = massKilograms(size, canonical);
  if (unitWeightKg == null) return null;
  const amount = formatAmount(size);
  const weight = formatAmount(unitWeightKg);
  const sentence = canonical === "g"
    ? `${amount} g equals ${weight} kg per unit.`
    : `For a ${amount} ${canonical} pack, weight per unit is ${weight} kg.`;
  return { unitWeightKg, sentence };
}

export function caseWeightKg(unitWeightKg: number, unitsPerCase: number) {
  return Math.round(unitWeightKg * unitsPerCase * 1000) / 1000;
}

export function buildDraftPack(input: { packSize: string; unit: string; unitsPerCase: string; measuredWeightKg?: string }) {
  const fields: DraftPackFields = {};
  const unit = canonicalUnit(input.unit);
  if (!unit) fields.unit = "Choose kg, g, quintal, or pcs.";
  const size = Number(input.packSize);
  if (!input.packSize.trim() || !Number.isFinite(size) || size <= 0) fields.packSize = "Enter a pack size greater than zero.";
  else if (unit === "pcs" && !Number.isSafeInteger(size)) fields.packSize = "Piece count must be a whole number.";
  const unitsPerCase = Number(input.unitsPerCase);
  if (!input.unitsPerCase.trim() || !Number.isSafeInteger(unitsPerCase) || unitsPerCase <= 0 || unitsPerCase > 2147483647) fields.unitsPerCase = "Units per case must be a whole number.";

  let unitWeightKg: number | null = null;
  if (!fields.packSize && unit && unit !== "pcs") {
    unitWeightKg = massKilograms(size, unit);
    if (unitWeightKg == null) fields.weight = "Derived weight must be a positive number with at most three decimal places.";
  }
  if (unit === "pcs" && !fields.packSize) {
    const measured = Number(input.measuredWeightKg);
    if (!input.measuredWeightKg?.trim() || !Number.isFinite(measured) || measured <= 0) fields.weight = "Enter the measured weight per piece in kg.";
    else {
      const rounded = Math.round(measured * 1000) / 1000;
      if (Math.abs(rounded - measured) > 1e-9 || !/^\d+(?:\.\d{1,3})?$/.test(String(rounded))) fields.weight = "Measured weight must fit three decimal places.";
      else unitWeightKg = rounded;
    }
  }

  if (Object.keys(fields).length || !unit || unitWeightKg == null || !Number.isSafeInteger(unitsPerCase)) return { ok: false as const, fields };
  return {
    ok: true as const,
    pack: {
      unitSize: `${formatAmount(size)} ${unit}`,
      unit,
      unitsPerCase,
      unitWeightKg,
    } satisfies DraftPackPayload,
  };
}

function textOf(detail: unknown) {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "error" in detail && typeof detail.error === "string") return detail.error;
  return "";
}

export function humanizePackFailure(body: { error?: string; details?: unknown } | null | undefined) {
  const fields: DraftPackFields = {};
  const messages: string[] = [];
  const details = body?.details;
  const raw = Array.isArray(details)
    ? details.map(textOf)
    : details && typeof details === "object"
      ? Object.entries((details as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {}).flatMap(([field, errors]) => errors.map((error) => `${field} ${error}`))
      : [];
  for (const detail of raw.filter(Boolean)) {
    const lower = detail.toLowerCase();
    const message = lower.includes("imageurl") || lower.includes("image url") || lower.includes("product.imageurl")
      ? "Enter a valid Image URL or leave it blank."
      : detail.includes("unitsPerCase")
      ? "Units per case must be a whole number."
      : detail.includes("Piece count")
        ? "Piece count must be a whole number."
        : detail.includes("explicitly positive")
          ? "Enter the measured weight per piece in kg."
          : detail.includes("three decimal")
            ? "Weight per unit must fit three decimal places."
            : detail.includes("unitWeightKg must equal")
              ? "The weight does not match this pack size."
              : detail.includes("unitSize")
                ? "Enter a pack size greater than zero."
                : "Check the pack size, unit, and units per case.";
    messages.push(message);
    if (lower.includes("imageurl") || lower.includes("image url") || lower.includes("product.imageurl")) fields.imageUrl = message;
    else if (detail.includes("unitsPerCase")) fields.unitsPerCase = message;
    else if (detail.includes("unitWeight") || detail.includes("explicitly positive") || detail.includes("three decimal")) fields.weight = message;
    else if (detail.includes("Piece count") || detail.includes("unitSize")) fields.packSize = message;
    else if (detail.toLowerCase().includes("unit")) fields.unit = message;
  }
  if (!messages.length && body?.error === "product_name_exists") messages.push("A product with this name already exists.");
  if (!messages.length && body?.error === "duplicate_pack") messages.push("This pack is already on the product.");
  if (!messages.length && body?.error && body.error !== "invalid_pack") messages.push("Could not save this draft pack.");
  if (!messages.length && body?.error === "invalid_pack") messages.push("Check the pack size, unit, and units per case.");
  return { message: messages[0] ?? "Could not save this draft pack.", fields };
}
