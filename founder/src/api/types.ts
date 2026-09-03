export type TrendPeriod = "7D" | "30D" | "90D";

export interface FounderTrend {
  metric: string;
  label: string;
  unit: "inr" | "percent" | "count";
  period: TrendPeriod;
  points: Array<{ date: string; value: number | null }>;
  currentValue: number | null;
  availability: "available" | "unavailable";
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
  sourceStatus: "ok" | "partial";
  isStale: boolean;
  trends: FounderTrend[];
}

export interface FounderIssue {
  id: string;
  category: string;
  severity: "WATCH" | "HIGH" | "CRITICAL";
  title: string;
  explanation: string;
  businessImpact: { amount: number | null; unit: "inr" | "count" };
  affectedObjects: { orders?: number; retailers?: number; outbox?: number; invoices?: number };
  owner: string;
  ageHours: number | null;
  status: "open" | "resolved";
  expectedNext?: string;
  asOf: string;
}

export interface FounderIssueDetail extends FounderIssue {
  affected: {
    orders: Array<{ id: string; ref: string; total: number; retailerName: string; status: string }>;
    retailers: Array<{ id: string; name: string }>;
  };
}

export interface FounderDecision {
  id: string;
  type: string;
  title: string;
  amount: number | null;
  requester: string;
  owner: string;
  context: string[];
  recommendation: "APPROVE" | "DECLINE" | "REVIEW";
  recommendedBy: string;
  recommendationReason: string;
  availableActions: Array<"approve" | "decline">;
  unavailableActions: Array<{ id: string; reason: string }>;
  createdAt: string;
  dueAt: string | null;
  status: "open" | "approved" | "declined";
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

export interface FounderTeam {
  asOf: string;
  period: { label: string };
  nodes: Array<{
    id: string;
    name: string;
    role: string;
    orderValue: number;
    activeRetailers: number;
    children?: FounderTeam["nodes"];
  }>;
}
