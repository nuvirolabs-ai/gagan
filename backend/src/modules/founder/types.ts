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
  affectedObjects: { orders?: number; retailers?: number; outbox?: number; invoices?: number };
  owner: string;
  ageHours: number | null;
  status: "open" | "resolved";
  expectedNext?: string;
  drilldown?: { kind: string; id?: string };
  asOf: string;
}

export interface FounderIssueDetail extends FounderIssue {
  affected: {
    orders: Array<{ id: string; ref: string; total: number; retailerName: string; status: string }>;
    retailers: Array<{ id: string; name: string }>;
  };
}

export type TrendPeriod = "7D" | "30D" | "90D";

export interface FounderTrendPoint {
  date: string;
  value: number | null;
}

export interface FounderTrend {
  metric: string;
  label: string;
  unit: MetricUnit;
  period: TrendPeriod;
  points: FounderTrendPoint[];
  currentValue: number | null;
  availability: MetricAvailability;
  unavailableReason?: string;
  comparison: {
    previousValue: number | null;
    changePercent: number | null;
    direction: "up" | "down" | "flat";
    label: string;
  } | null;
  interpretation: string;
  asOf: string;
  sourceStatus: "ok" | "partial";
  isStale: boolean;
}

export interface FounderTrends {
  asOf: string;
  period: TrendPeriod;
  timeZone: string;
  sourceStatus: "ok" | "partial";
  isStale: boolean;
  trends: FounderTrend[];
}

export type FounderDecisionType = "CREDIT_EXCEPTION" | "EXECUTIVE_ESCALATION";
export type FounderDecisionStatus = "open" | "approved" | "declined";

export interface FounderDecision {
  id: string;
  type: FounderDecisionType;
  title: string;
  amount: number | null;
  requester: string;
  owner: string;
  context: string[];
  recommendation: "APPROVE" | "DECLINE" | "REVIEW";
  recommendedBy: string;
  recommendationReason: string;
  availableActions: Array<"approve" | "decline">;
  unavailableActions: Array<{ id: "askOwner"; reason: string }>;
  createdAt: string;
  dueAt: string | null;
  status: FounderDecisionStatus;
  auditRequired: boolean;
}

export interface FounderDecisions {
  asOf: string;
  segment: "open" | "history";
  decisions: FounderDecision[];
  unavailableTypes: Array<{ type: string; reason: string }>;
}

export interface FounderBrief {
  kind: "morning" | "evening";
  asOf: string;
  title: string;
  statements: string[];
  omitted: string[];
}

export interface FounderTeamNode {
  id: string;
  name: string;
  role: string;
  orderValue: number;
  activeRetailers: number;
  children?: FounderTeamNode[];
}

export interface FounderTeam {
  asOf: string;
  period: { start: string; end: string; label: string };
  nodes: FounderTeamNode[];
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
