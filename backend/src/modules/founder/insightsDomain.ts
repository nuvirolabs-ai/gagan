import { round2 } from "./metricsDomain";
import type { FounderHealthDomain, FounderInsight } from "./types";

export function composeSummary(health: FounderHealthDomain[]): {
  headline: string;
  tone: "healthy" | "watch" | "risk";
} {
  const risk = health.filter((domain) => domain.status === "AT_RISK");
  const watch = health.filter((domain) => domain.status === "WATCH");
  if (risk.length > 0) {
    const names = risk.map((domain) => domain.domain.toLowerCase());
    return {
      tone: "risk",
      headline: `Attention required: ${joinDomains(names)} ${names.length === 1 ? "is" : "are"} at risk.`,
    };
  }
  if (watch.length > 0) {
    const names = watch.map((domain) => domain.domain.toLowerCase());
    const healthy = health.filter((domain) => domain.status === "HEALTHY").map((domain) => domain.domain.toLowerCase());
    if (healthy.includes("sales") && names.includes("collections")) {
      return {
        tone: "watch",
        headline: "Sales are tracking, while collections need attention.",
      };
    }
    return {
      tone: "watch",
      headline: `${joinDomains(names, true)} ${names.length === 1 ? "needs" : "need"} attention.`,
    };
  }
  return { tone: "healthy", headline: "Business is healthy overall." };
}

function joinDomains(names: string[], capitalize = false): string {
  const display = names.map((name, index) => (capitalize && index === 0 ? cap(name) : name));
  if (display.length === 1) return display[0];
  if (display.length === 2) return `${display[0]} and ${display[1]}`;
  return `${display.slice(0, -1).join(", ")}, and ${display[display.length - 1]}`;
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function composeInsights(input: {
  asOf: string;
  ordersToday: number;
  ordersComparable: number;
  collectionsToday: number;
  collectionsComparable: number;
  fillRateToday: number | null;
  fillRateComparable: number | null;
  inventoryUniqueBlocked: number;
  inventoryOrderCount: number;
}): FounderInsight[] {
  const insights: FounderInsight[] = [];
  const orderDelta = round2(input.ordersToday - input.ordersComparable);
  if (input.ordersComparable > 0 && Math.abs(orderDelta) / input.ordersComparable >= 0.05) {
    insights.push({
      id: "orders-pace",
      type: orderDelta > 0 ? "POSITIVE_CHANGE" : "NEGATIVE_CHANGE",
      title: orderDelta > 0 ? "Sales accelerated" : "Sales slowed",
      explanation:
        orderDelta > 0
          ? `Order value is ahead of last ${weekday(input.asOf)}.`
          : `Order value is behind last ${weekday(input.asOf)}.`,
      businessImpact: { amount: Math.abs(orderDelta), unit: "inr" },
      driver: "orders",
      drilldown: { kind: "orders" },
      asOf: input.asOf,
    });
  }

  const collectionDelta = round2(input.collectionsToday - input.collectionsComparable);
  if (input.collectionsComparable > 0 && Math.abs(collectionDelta) / input.collectionsComparable >= 0.05) {
    insights.push({
      id: "collections-pace",
      type: collectionDelta > 0 ? "RECOVERY" : "NEGATIVE_CHANGE",
      title: collectionDelta > 0 ? "Collections strengthened" : "Collections weakened",
      explanation:
        collectionDelta > 0
          ? "Confirmed collections are ahead of the comparable day."
          : "Confirmed collections are behind the comparable day.",
      businessImpact: { amount: Math.abs(collectionDelta), unit: "inr" },
      driver: "collections",
      drilldown: { kind: "collections" },
      asOf: input.asOf,
    });
  }

  if (
    input.fillRateToday != null &&
    input.fillRateComparable != null &&
    input.fillRateToday - input.fillRateComparable <= -2
  ) {
    insights.push({
      id: "fill-rate",
      type: "NEGATIVE_CHANGE",
      title: "Fill rate fell",
      explanation: `Fill rate is ${input.fillRateToday}% versus ${input.fillRateComparable}% on the comparable day.`,
      businessImpact: { amount: round2(input.fillRateComparable - input.fillRateToday), unit: "percent" },
      driver: "fillRate",
      drilldown: { kind: "fulfilment" },
      asOf: input.asOf,
    });
  }

  if (input.inventoryUniqueBlocked > 0) {
    insights.push({
      id: "inventory-pressure",
      type: "EMERGING_RISK",
      title: "Inventory pressure increased",
      explanation: `${input.inventoryOrderCount} open ${input.inventoryOrderCount === 1 ? "order is" : "orders are"} short of stock.`,
      businessImpact: { amount: input.inventoryUniqueBlocked, unit: "inr" },
      driver: "inventory",
      drilldown: { kind: "blocked" },
      asOf: input.asOf,
    });
  }

  return insights;
}

function weekday(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
