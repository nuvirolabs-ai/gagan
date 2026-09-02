export type MetricUnit = "inr" | "percent" | "count";
export type MetricAvailability = "available" | "unavailable";
export type HealthStatus = "HEALTHY" | "WATCH" | "AT_RISK";
export type InsightType = "POSITIVE_CHANGE" | "NEGATIVE_CHANGE" | "EMERGING_RISK" | "RECOVERY";
export type IssueCategory = "MONEY" | "INVENTORY" | "EXECUTION" | "SALES" | "SYSTEM";
export type IssueSeverity = "WATCH" | "HIGH" | "CRITICAL";
export type BlockerCategory = "CREDIT" | "INVENTORY" | "DISPATCH" | "SYSTEM";

export interface FounderMetric {
  id: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  availability: MetricAvailability;
  unavailableReason?: string;
  delta: {
    amount: number;
    unit: "inr" | "percent" | "points" | "count";
    direction: "up" | "down" | "flat";
  } | null;
  deltaLabel?: string;
  asOf: string;
}

export interface FounderInsight {
  id: string;
  type: InsightType;
  title: string;
  explanation: string;
  businessImpact: { amount: number | null; unit: "inr" | "percent" | "count" | "none" };
  driver?: string;
  drilldown?: { kind: string; id?: string };
  asOf: string;
}

export interface FounderBlockedCategory {
  id: BlockerCategory;
  uniqueValue: number;
  orderCount: number;
}

export interface FounderBlockedSummary {
  totalUniqueValue: number;
  grossConstraintImpact: number;
  orderCount: number;
  categories: FounderBlockedCategory[];
  asOf: string;
}

export interface FounderHealthDomain {
  domain: "Sales" | "Collections" | "Inventory" | "Fulfilment" | "Receivables" | "Sales Team" | "Systems";
  status: HealthStatus;
  reason: string;
  primaryMetric: string;
  drilldown?: { kind: string };
  asOf: string;
}

export interface FounderIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  explanation: string;
  businessImpact: { amount: number | null; unit: "inr" | "count" };
  affectedObjects: { orders?: number; retailers?: number; outbox?: number };
  owner: string;
  ageHours: number | null;
  drilldown?: { kind: string };
  asOf: string;
}

export interface FounderPulse {
  asOf: string;
  period: { start: string; end: string; timeZone: string; label: string };
  sourceStatus: "ok" | "partial";
  isStale: boolean;
  viewer: { staffId: string; name: string };
  summary: { greeting: string; headline: string; tone: "healthy" | "watch" | "risk" };
  metrics: FounderMetric[];
  secondaryMetrics: FounderMetric[];
  changes: FounderInsight[];
  blocked: FounderBlockedSummary;
  health: FounderHealthDomain[];
  issues: FounderIssue[];
  pendingDecisions: { count: number; label: string };
}
