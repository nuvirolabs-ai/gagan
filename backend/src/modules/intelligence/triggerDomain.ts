/**
 * Turns a retailer's baseline into things a salesperson could do today.
 *
 * Every trigger states what was measured and why that made it fire, in the
 * hedged language the measurement actually supports: "usually", "typical",
 * "based on recent orders". A statistical expectation is never presented as a
 * prediction, and no trigger fires from history too thin to support it.
 */

import type { RetailerBaseline } from "./baselineDomain";

export type TriggerType =
  | "ORDER_DUE"
  | "VISIT_OVERDUE"
  | "HIGH_VALUE_RETAILER_MISSED"
  | "ORDER_VALUE_BELOW_NORMAL"
  | "LINE_ITEMS_BELOW_NORMAL"
  | "COLLECTION_DUE"
  | "CATEGORY_REORDER_OPPORTUNITY";

export interface Measurement {
  label: string;
  value: string;
}

export interface SalesTrigger {
  type: TriggerType;
  retailerId: string;
  retailerName: string;
  salespersonId: string;
  /** One sentence: what was noticed. */
  headline: string;
  /** Why it fired, in the measurement's own hedged language. */
  why: string;
  /** The numbers behind it, so the salesperson can judge it themselves. */
  measurements: Measurement[];
  recommendedAction: string;
  /** 0–100. Higher means more worth doing before the others. */
  priority: number;
  generatedAt: Date;
  /** After this the measurement is stale enough to be worth recomputing. */
  expiresAt: Date;
}

export interface TriggerContext {
  retailerId: string;
  retailerName: string;
  salespersonId: string;
  baseline: RetailerBaseline;
  /** Canonical overdue receivable; finance owns this number. */
  overdueAmount: number;
  /** This retailer's share of the salesperson's recent order value, 0–1. */
  valueShare: number;
  now: Date;
}

/** A cycle is only "missed" once it is meaningfully past, not a day late. */
export const ORDER_DUE_TOLERANCE = 1.15;

/** Below this share of the usual figure, an order is worth a second look. */
export const BELOW_NORMAL_RATIO = 0.6;

/** A retailer at or above this share of a salesperson's value is high-value. */
export const HIGH_VALUE_SHARE = 0.1;

/** Baselines drift; a trigger is only good for a day. */
const RELEVANCE_HOURS = 24;

function money(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function days(value: number): string {
  return `${value} day${value === 1 ? "" : "s"}`;
}

function base(context: TriggerContext) {
  return {
    retailerId: context.retailerId,
    retailerName: context.retailerName,
    salespersonId: context.salespersonId,
    generatedAt: context.now,
    expiresAt: new Date(context.now.getTime() + RELEVANCE_HOURS * 60 * 60 * 1000),
  };
}

/** Rounds into the 0–100 band and keeps the result an integer. */
function priority(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * All triggers a retailer currently justifies.
 *
 * A retailer past their usual cycle produces either ORDER_DUE or, when they
 * are a large part of this salesperson's book, HIGH_VALUE_RETAILER_MISSED —
 * never both, because they are the same fact at two volumes.
 */
export function triggersFor(context: TriggerContext): SalesTrigger[] {
  const triggers: SalesTrigger[] = [];
  const { baseline } = context;

  const overdueCycle =
    baseline.hasIntervalBaseline &&
    baseline.medianIntervalDays != null &&
    baseline.daysSinceLastOrder != null &&
    baseline.daysSinceLastOrder > baseline.medianIntervalDays * ORDER_DUE_TOLERANCE;

  if (overdueCycle) {
    const interval = baseline.medianIntervalDays!;
    const since = baseline.daysSinceLastOrder!;
    const overdueBy = since - interval;
    const highValue = context.valueShare >= HIGH_VALUE_SHARE;
    const measurements: Measurement[] = [
      { label: "Usual order cycle", value: days(Math.round(interval)) },
      { label: "Days since last order", value: days(since) },
      { label: "Based on", value: `${baseline.orderCount} recent orders` },
    ];
    if (baseline.medianOrderValue != null) {
      measurements.push({ label: "Typical order", value: money(baseline.medianOrderValue) });
    }

    triggers.push({
      ...base(context),
      type: highValue ? "HIGH_VALUE_RETAILER_MISSED" : "ORDER_DUE",
      headline: highValue
        ? `${context.retailerName} is a big account and is past its usual cycle`
        : `${context.retailerName} is past its usual order cycle`,
      why: `Usually orders every ${days(Math.round(interval))}, based on ${baseline.orderCount} recent orders. It has been ${days(since)}.`,
      measurements,
      recommendedAction: highValue ? "Call or visit today" : "Follow up today",
      priority: priority(
        (highValue ? 62 : 45) +
          Math.min(25, (overdueBy / Math.max(1, interval)) * 25) +
          context.valueShare * 25
      ),
    });
  }

  if (
    baseline.hasValueBaseline &&
    baseline.medianOrderValue != null &&
    baseline.lastOrderValue != null &&
    baseline.medianOrderValue > 0 &&
    baseline.lastOrderValue < baseline.medianOrderValue * BELOW_NORMAL_RATIO
  ) {
    const shortfall = baseline.medianOrderValue - baseline.lastOrderValue;
    triggers.push({
      ...base(context),
      type: "ORDER_VALUE_BELOW_NORMAL",
      headline: `${context.retailerName} ordered below its usual basket`,
      why: `Typical order is ${money(baseline.medianOrderValue)} based on ${baseline.orderCount} recent orders. The last one was ${money(baseline.lastOrderValue)}.`,
      measurements: [
        { label: "Typical order", value: money(baseline.medianOrderValue) },
        { label: "Last order", value: money(baseline.lastOrderValue) },
        { label: "Potential opportunity", value: `${money(shortfall)} below normal` },
      ],
      recommendedAction: "Check what they skipped on the next visit",
      priority: priority(35 + (shortfall / baseline.medianOrderValue) * 25 + context.valueShare * 20),
    });
  }

  if (
    baseline.hasValueBaseline &&
    baseline.medianLineItems != null &&
    baseline.lastOrderLineItems != null &&
    baseline.medianLineItems >= 3 &&
    baseline.lastOrderLineItems < baseline.medianLineItems * BELOW_NORMAL_RATIO
  ) {
    const missing = Math.round(baseline.medianLineItems - baseline.lastOrderLineItems);
    triggers.push({
      ...base(context),
      type: "LINE_ITEMS_BELOW_NORMAL",
      headline: `${context.retailerName} bought a narrower range than usual`,
      why: `Usually takes ${Math.round(baseline.medianLineItems)} lines an order, based on ${baseline.orderCount} recent orders. The last one had ${baseline.lastOrderLineItems}.`,
      measurements: [
        { label: "Usual lines", value: String(Math.round(baseline.medianLineItems)) },
        { label: "Last order", value: String(baseline.lastOrderLineItems) },
        { label: "Potential opportunity", value: `${missing} more lines` },
      ],
      recommendedAction: "Take the full range next visit",
      priority: priority(30 + context.valueShare * 20),
    });
  }

  const missingCategories = baseline.regularCategories.filter(
    (category) => !baseline.lastOrderCategories.includes(category)
  );
  if (baseline.hasValueBaseline && missingCategories.length > 0 && overdueCycle) {
    triggers.push({
      ...base(context),
      type: "CATEGORY_REORDER_OPPORTUNITY",
      headline: `${context.retailerName} usually buys ${missingCategories.join(", ")}`,
      why: `${missingCategories.join(", ")} appears in most of their recent orders but not the last one.`,
      measurements: [
        { label: "Usually buys", value: baseline.regularCategories.join(", ") },
        { label: "Missing from last order", value: missingCategories.join(", ") },
        { label: "Based on", value: `${baseline.orderCount} recent orders` },
      ],
      recommendedAction: `Offer ${missingCategories[0]} on the next visit`,
      priority: priority(28 + context.valueShare * 20),
    });
  }

  if (
    baseline.hasIntervalBaseline &&
    baseline.medianIntervalDays != null &&
    baseline.daysSinceLastVisit != null &&
    baseline.daysSinceLastVisit > baseline.medianIntervalDays * 2
  ) {
    triggers.push({
      ...base(context),
      type: "VISIT_OVERDUE",
      headline: `${context.retailerName} has not been visited in a while`,
      why: `Usually orders every ${days(Math.round(baseline.medianIntervalDays))}, and the last visit was ${days(baseline.daysSinceLastVisit)} ago.`,
      measurements: [
        { label: "Days since last visit", value: days(baseline.daysSinceLastVisit) },
        { label: "Usual order cycle", value: days(Math.round(baseline.medianIntervalDays)) },
      ],
      recommendedAction: "Add to today's route",
      priority: priority(38 + context.valueShare * 25),
    });
  }

  if (context.overdueAmount > 0) {
    triggers.push({
      ...base(context),
      type: "COLLECTION_DUE",
      headline: `${context.retailerName} has ${money(context.overdueAmount)} overdue`,
      why: `Finance shows ${money(context.overdueAmount)} past its due date on this account.`,
      measurements: [{ label: "Overdue", value: money(context.overdueAmount) }],
      recommendedAction: "Collect on the next visit",
      // Money already owed outranks a possible future order.
      priority: priority(55 + Math.min(30, context.overdueAmount / 5000)),
    });
  }

  return triggers;
}

/** Highest priority first, then newest, then by store for a stable order. */
export function sortTriggers(triggers: readonly SalesTrigger[]): SalesTrigger[] {
  return [...triggers].sort(
    (a, b) =>
      b.priority - a.priority ||
      a.retailerName.localeCompare(b.retailerName) ||
      a.type.localeCompare(b.type)
  );
}

/**
 * A one-line summary per trigger type, for the Today screen's short list.
 * Today shows the shape of the day, not every finding.
 */
export function summarise(triggers: readonly SalesTrigger[]): Array<{
  type: TriggerType;
  count: number;
  headline: string;
  priority: number;
}> {
  const byType = new Map<TriggerType, SalesTrigger[]>();
  for (const trigger of triggers) {
    byType.set(trigger.type, [...(byType.get(trigger.type) ?? []), trigger]);
  }

  const summaries: Array<{
    type: TriggerType;
    count: number;
    headline: string;
    priority: number;
  }> = [];
  for (const [type, group] of byType) {
    summaries.push({
      type,
      count: group.length,
      headline: summaryHeadline(type, group),
      // The line's weight is its most urgent member, so Today leads with the
      // thing most worth doing rather than whichever type sorts first.
      priority: Math.max(...group.map((trigger) => trigger.priority)),
    });
  }
  return summaries.sort(
    (a, b) => b.priority - a.priority || b.count - a.count || a.type.localeCompare(b.type)
  );
}

function summaryHeadline(type: TriggerType, group: readonly SalesTrigger[]): string {
  const count = group.length;
  switch (type) {
    case "ORDER_DUE":
      return `${count} ${count === 1 ? "retailer" : "retailers"} overdue for an order`;
    case "HIGH_VALUE_RETAILER_MISSED":
      return `${count} high-value ${count === 1 ? "outlet" : "outlets"} past the usual cycle`;
    case "VISIT_OVERDUE":
      return `${count} ${count === 1 ? "store" : "stores"} not visited recently`;
    case "COLLECTION_DUE": {
      const total = group.reduce((sum, trigger) => {
        const amount = trigger.measurements.find((m) => m.label === "Overdue")?.value ?? "0";
        return sum + Number(amount.replace(/[^0-9.]/g, ""));
      }, 0);
      return `₹${Math.round(total).toLocaleString("en-IN")} collections due`;
    }
    case "ORDER_VALUE_BELOW_NORMAL":
      return `${count} ${count === 1 ? "store" : "stores"} ordering below usual`;
    case "LINE_ITEMS_BELOW_NORMAL":
      return `${count} ${count === 1 ? "store" : "stores"} buying a narrower range`;
    case "CATEGORY_REORDER_OPPORTUNITY":
      return `${count} category reorder ${count === 1 ? "opportunity" : "opportunities"}`;
    default:
      return `${count} to review`;
  }
}
