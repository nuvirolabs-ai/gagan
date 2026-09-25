import { FOUNDER_HEALTH_RULES } from "./healthRules";
import { pace } from "./metricsDomain";
import type { FounderHealthDomain, HealthStatus } from "./types";

function band(
  ratio: number | null,
  healthyMin: number,
  watchMin: number
): HealthStatus {
  if (ratio == null) return "WATCH";
  if (ratio >= healthyMin) return "HEALTHY";
  if (ratio >= watchMin) return "WATCH";
  return "AT_RISK";
}

const unavailable = "Not enough canonical data to judge this domain.";

export function salesHealth(today: number, comparable: number, asOf: string): FounderHealthDomain {
  const ratio = pace(today, comparable);
  const status = band(ratio, FOUNDER_HEALTH_RULES.sales.healthyMin, FOUNDER_HEALTH_RULES.sales.watchMin);
  const reason =
    ratio == null && comparable === 0 && today > 0
      ? "No comparable-day baseline; today has orders."
      : status === "HEALTHY"
        ? "Order value is at or above expected pace."
        : status === "WATCH"
          ? "Order value is behind the comparable day."
          : "Order value is well behind the comparable day.";
  return { domain: "Sales", status, reason, primaryMetric: "orders", drilldown: { kind: "orders" }, asOf };
}

export function collectionsHealth(today: number, comparable: number, asOf: string): FounderHealthDomain {
  const ratio = pace(today, comparable);
  const status = band(
    ratio,
    FOUNDER_HEALTH_RULES.collections.healthyMin,
    FOUNDER_HEALTH_RULES.collections.watchMin
  );
  const reason =
    status === "HEALTHY"
      ? "Confirmed collections are at or above expected pace."
      : status === "WATCH"
        ? "Confirmed collections are behind the comparable day."
        : "Confirmed collections are well behind the comparable day.";
  return { domain: "Collections", status, reason, primaryMetric: "collections", drilldown: { kind: "collections" }, asOf };
}

export function fulfilmentHealth(fillRate: number | null, asOf: string): FounderHealthDomain {
  if (fillRate == null) {
    return {
      domain: "Fulfilment",
      status: "WATCH",
      reason: unavailable,
      primaryMetric: "fillRate",
      drilldown: { kind: "fulfilment" },
      asOf,
    };
  }
  const status = band(
    fillRate,
    FOUNDER_HEALTH_RULES.fulfilment.healthyMin,
    FOUNDER_HEALTH_RULES.fulfilment.watchMin
  );
  const reason =
    status === "HEALTHY"
      ? "Fill rate is at or above 95%."
      : status === "WATCH"
        ? "Fill rate is between 90% and 95%."
        : "Fill rate is below 90%.";
  return { domain: "Fulfilment", status, reason, primaryMetric: "fillRate", drilldown: { kind: "fulfilment" }, asOf };
}

export function inventoryHealth(
  inventoryUniqueBlocked: number,
  openOrderValue: number,
  asOf: string
): FounderHealthDomain {
  if (openOrderValue <= 0) {
    return {
      domain: "Inventory",
      status: "HEALTHY",
      reason: "No open orders waiting on stock.",
      primaryMetric: "blocked",
      drilldown: { kind: "blocked" },
      asOf,
    };
  }
  const share = inventoryUniqueBlocked / openOrderValue;
  const status =
    share >= FOUNDER_HEALTH_RULES.inventory.riskMin
      ? "AT_RISK"
      : share >= FOUNDER_HEALTH_RULES.inventory.watchMin
        ? "WATCH"
        : "HEALTHY";
  const reason =
    status === "HEALTHY"
      ? "Inventory is not holding a material share of open orders."
      : status === "WATCH"
        ? "Inventory is blocking a noticeable share of open order value."
        : "Inventory is blocking a material share of open order value.";
  return { domain: "Inventory", status, reason, primaryMetric: "blocked", drilldown: { kind: "blocked" }, asOf };
}

export function receivablesHealth(
  outstanding: number | null,
  overdue: number | null,
  asOf: string
): FounderHealthDomain {
  if (outstanding == null || overdue == null) {
    return {
      domain: "Receivables",
      status: "WATCH",
      reason: unavailable,
      primaryMetric: "overdue",
      drilldown: { kind: "receivables" },
      asOf,
    };
  }
  if (outstanding <= 0) {
    return {
      domain: "Receivables",
      status: "HEALTHY",
      reason: "No open invoice balance on the local ledger.",
      primaryMetric: "outstanding",
      drilldown: { kind: "receivables" },
      asOf,
    };
  }
  const share = overdue / outstanding;
  const status =
    share >= FOUNDER_HEALTH_RULES.receivables.riskMin
      ? "AT_RISK"
      : share >= FOUNDER_HEALTH_RULES.receivables.watchMin
        ? "WATCH"
        : "HEALTHY";
  const reason =
    status === "HEALTHY"
      ? "Overdue is a small share of outstanding."
      : status === "WATCH"
        ? "Overdue is a meaningful share of outstanding."
        : "Overdue is a large share of outstanding.";
  return { domain: "Receivables", status, reason, primaryMetric: "overdue", drilldown: { kind: "receivables" }, asOf };
}

export function salesTeamHealth(
  openSessions: number,
  expectedSalespeople: number,
  isWorkingDay: boolean,
  asOf: string
): FounderHealthDomain {
  if (!isWorkingDay) {
    return {
      domain: "Sales Team",
      status: "HEALTHY",
      reason: "Not a working day on the company calendar.",
      primaryMetric: "activeSalespeople",
      drilldown: { kind: "team" },
      asOf,
    };
  }
  if (expectedSalespeople <= 0) {
    return {
      domain: "Sales Team",
      status: "WATCH",
      reason: unavailable,
      primaryMetric: "activeSalespeople",
      drilldown: { kind: "team" },
      asOf,
    };
  }
  const ratio = openSessions / expectedSalespeople;
  const status = band(
    ratio,
    FOUNDER_HEALTH_RULES.salesTeam.healthyMin,
    FOUNDER_HEALTH_RULES.salesTeam.watchMin
  );
  const reason =
    status === "HEALTHY"
      ? "Most expected salespeople have started their day."
      : status === "WATCH"
        ? "Some expected salespeople have not started their day."
        : "Many expected salespeople have not started their day.";
  return { domain: "Sales Team", status, reason, primaryMetric: "activeSalespeople", drilldown: { kind: "team" }, asOf };
}

export function systemsHealth(failedOutbox: number, asOf: string): FounderHealthDomain {
  const status =
    failedOutbox >= FOUNDER_HEALTH_RULES.systems.riskMin
      ? "AT_RISK"
      : failedOutbox >= FOUNDER_HEALTH_RULES.systems.watchMin
        ? "WATCH"
        : "HEALTHY";
  const reason =
    failedOutbox === 0
      ? "No critical system issues detected."
      : `${failedOutbox} SAP outbox ${failedOutbox === 1 ? "row has" : "rows have"} failed.`;
  return { domain: "Systems", status, reason, primaryMetric: "sapOutbox", drilldown: { kind: "systems" }, asOf };
}
