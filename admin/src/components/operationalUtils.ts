export type VisualTone = "neutral" | "active" | "moving" | "bottleneck" | "complete" | "warning" | "critical";

export type FlowStage = {
  label: string;
  count: number;
  value: number;
  tone: VisualTone;
  note: string;
  retention: string;
};

export function inrShort(value: number) {
  const amount = Math.round(Number(value) || 0);
  if (Math.abs(amount) >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function validDate(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function ageLabel(value: unknown, now = Date.now()) {
  const date = validDate(value);
  if (!date) return "Age unavailable";
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return `${hours}h ${String(remainder).padStart(2, "0")}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function ageHours(value: unknown, now = Date.now()) {
  const date = validDate(value);
  return date ? Math.max(0, (now - date.getTime()) / 3600000) : null;
}
