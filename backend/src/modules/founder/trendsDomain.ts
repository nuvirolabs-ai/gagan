import { pace, round2 } from "./metricsDomain";

export type TrendMetricId =
  | "orders"
  | "collections"
  | "activeRetailers"
  | "fillRate"
  | "overdue"
  | "salesTeam";

export interface TrendPoint {
  date: string;
  value: number | null;
}

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return round2(((current - previous) / previous) * 100);
}

export function interpretTrend(input: {
  id: TrendMetricId;
  current: number | null;
  previous: number | null;
  unavailable?: boolean;
}): string {
  if (input.unavailable || input.current == null) {
    if (input.id === "overdue") {
      return "Overdue is a point-in-time ledger figure until a historical series exists.";
    }
    if (input.id === "fillRate") {
      return "Fill rate is unavailable until fulfilment has started in this period.";
    }
    return "Not enough canonical data to interpret this trend.";
  }
  const change = percentChange(input.current, input.previous);
  const ratio = input.previous == null ? null : pace(input.current, input.previous ?? 0);
  if (input.id === "overdue" && input.previous == null) {
    return "Overdue is taken from today's invoice ledger, not a reconstructed history.";
  }
  if (change == null || ratio == null) {
    return `${label(input.id)} has no comparable prior period.`;
  }
  if (Math.abs(change) < 5) return stabilized(input.id);
  if (input.id === "overdue" || input.id === "fillRate") {
    if (input.id === "fillRate") {
      return change > 0 ? "Fill rate is improving." : "Fill rate is weakening.";
    }
    return change > 0 ? "Overdue is rising." : "Overdue is easing.";
  }
  if (input.id === "collections") {
    return change > 0 ? "Collections are strengthening." : "Collections are weakening.";
  }
  if (input.id === "activeRetailers") {
    return change > 0 ? "Active retailer count is improving." : "Active retailer count is softening.";
  }
  if (input.id === "salesTeam") {
    return change > 0 ? "Sales-team productivity is improving." : "Sales-team productivity is weakening.";
  }
  return change > 0 ? "Orders are accelerating." : "Orders are slowing.";
}

function stabilized(id: TrendMetricId): string {
  switch (id) {
    case "orders":
      return "Orders have stabilized.";
    case "collections":
      return "Collections have stabilized.";
    case "activeRetailers":
      return "Active retailer count has stabilized.";
    case "fillRate":
      return "Fill rate has stabilized.";
    case "overdue":
      return "Overdue has stabilized.";
    case "salesTeam":
      return "Sales-team productivity has stabilized.";
  }
}

function label(id: TrendMetricId): string {
  switch (id) {
    case "orders":
      return "Orders";
    case "collections":
      return "Collections";
    case "activeRetailers":
      return "Active retailers";
    case "fillRate":
      return "Fill rate";
    case "overdue":
      return "Overdue";
    case "salesTeam":
      return "Sales-team productivity";
  }
}
