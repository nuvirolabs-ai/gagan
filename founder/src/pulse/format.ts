/** Compact Indian grouping used on the Quiet Instrument board. */

function trimNumber(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** 4260000 -> "₹42.6L"; 18400000 -> "₹1.84Cr" */
export function compactInr(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_00_00_000) {
    return `${sign}₹${trimNumber(abs / 1_00_00_000, 2)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${trimNumber(abs / 1_00_000, 1)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${trimNumber(abs / 1_000, 0)}k`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

export function lakhs(value: number): number {
  return value * 1_00_000;
}

export function crores(value: number): number {
  return value * 1_00_00_000;
}

export type DeltaKind = "pct" | "pp" | "abs" | "flat" | "none";

export function formatDelta(kind: DeltaKind, value: number | null, digits = 0): string {
  if (kind === "flat") return "flat";
  if (kind === "none" || value === null) return "—";
  const sign = value > 0 ? "+" : "";
  if (kind === "pct") return `${sign}${trimNumber(value, digits)}%`;
  if (kind === "pp") return `${sign}${trimNumber(value, digits)}pp`;
  return `${sign}${trimNumber(value, digits)}`;
}

export function deltaTone(kind: DeltaKind, value: number | null, invert = false): "up" | "down" | "muted" {
  if (kind === "none" || kind === "flat" || value === null || value === 0) return "muted";
  const up = invert ? value < 0 : value > 0;
  return up ? "up" : "down";
}

export function periodChip(prefix: "D" | "W" | "M", kind: DeltaKind, value: number | null, digits = 0): string {
  if (kind === "flat") return `${prefix} flat`;
  if (kind === "none" || value === null) return `${prefix} —`;
  return `${prefix} ${formatDelta(kind, value, digits)}`;
}
