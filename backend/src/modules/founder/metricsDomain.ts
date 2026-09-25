import type { FounderMetric, MetricUnit } from "./types";

export const VALID_ORDER_STATUSES = [
  "placed",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
] as const;

export const OPEN_ORDER_STATUSES = ["placed", "confirmed", "packed", "out_for_delivery"] as const;
export const FULFILMENT_STARTED_STATUSES = ["packed", "out_for_delivery", "delivered"] as const;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0));
}

export function isValidOrderStatus(status: string): boolean {
  return (VALID_ORDER_STATUSES as readonly string[]).includes(status);
}

export interface OrderLine {
  qtyOrdered: number;
  qtyDelivered: number | null;
}

export interface OrderForFill {
  status: string;
  items: OrderLine[];
}

export function deliveredQuantity(orderStatus: string, line: OrderLine): number {
  if (line.qtyDelivered != null) return line.qtyDelivered;
  if (orderStatus === "delivered") return line.qtyOrdered;
  return 0;
}

export function isFillEligible(order: OrderForFill): boolean {
  if (!isValidOrderStatus(order.status)) return false;
  if ((FULFILMENT_STARTED_STATUSES as readonly string[]).includes(order.status)) return true;
  return order.items.some((item) => item.qtyDelivered != null);
}

export function fillRate(orders: OrderForFill[]): number | null {
  const eligible = orders.filter(isFillEligible);
  const ordered = sum(eligible.flatMap((order) => order.items.map((item) => item.qtyOrdered)));
  if (ordered <= 0) return null;
  const delivered = sum(
    eligible.flatMap((order) => order.items.map((item) => deliveredQuantity(order.status, item)))
  );
  return round2((delivered / ordered) * 100);
}

export function pace(today: number, comparable: number): number | null {
  if (comparable === 0) return today === 0 ? 1 : null;
  return today / comparable;
}

export function deltaVsComparable(
  today: number | null,
  comparable: number | null,
  unit: "inr" | "percent" | "points" | "count"
): FounderMetric["delta"] {
  if (today == null || comparable == null) return null;
  const amount = round2(today - comparable);
  if (amount === 0) return { amount: 0, unit, direction: "flat" };
  return { amount: Math.abs(amount), unit, direction: amount > 0 ? "up" : "down" };
}

export function metric(input: {
  id: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  asOf: string;
  delta?: FounderMetric["delta"];
  unavailableReason?: string;
}): FounderMetric {
  if (input.value == null) {
    return {
      id: input.id,
      label: input.label,
      value: null,
      unit: input.unit,
      availability: "unavailable",
      unavailableReason: input.unavailableReason ?? "Canonical data is not available for this metric.",
      delta: null,
      asOf: input.asOf,
    };
  }
  return {
    id: input.id,
    label: input.label,
    value: input.value,
    unit: input.unit,
    availability: "available",
    delta: input.delta ?? null,
    deltaLabel: input.delta ? "vs comparable day" : undefined,
    asOf: input.asOf,
  };
}
