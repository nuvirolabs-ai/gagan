function trimZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Indian executive amounts: ₹48.2L, ₹1.42Cr, ₹12,500. */
export function formatInrExecutive(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  if (abs >= 10_000_000) {
    return `${sign}₹${trimZeros((abs / 10_000_000).toFixed(2))}Cr`;
  }
  if (abs >= 100_000) {
    return `${sign}₹${trimZeros((abs / 100_000).toFixed(2))}L`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

export function formatDelta(
  amount: number,
  unit: "inr" | "percent" | "points" | "count",
  direction: "up" | "down" | "flat"
): string {
  if (direction === "flat") return "No change";
  const arrow = direction === "up" ? "↑" : "↓";
  if (unit === "inr") return `${arrow} ${formatInrExecutive(amount)}`;
  if (unit === "points") return `${arrow} ${trimZeros(amount.toFixed(1))} pts`;
  if (unit === "percent") return `${arrow} ${trimZeros(amount.toFixed(0))}%`;
  return `${arrow} ${amount}`;
}

export function formatMetricValue(value: number, unit: "inr" | "percent" | "count"): string {
  if (unit === "inr") return formatInrExecutive(value);
  if (unit === "percent") return `${trimZeros(value.toFixed(0))}%`;
  return String(value);
}
