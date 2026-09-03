export interface FounderMetric {
  id: string;
  label: string;
  value: number | null;
  unit: "inr" | "percent" | "count";
  availability: "available" | "unavailable";
  unavailableReason?: string;
  delta: {
    amount: number;
    unit: "inr" | "percent" | "points" | "count";
    direction: "up" | "down" | "flat";
  } | null;
  deltaLabel?: string;
}

export interface FounderPulse {
  asOf: string;
  period: { label: string };
  sourceStatus: "ok" | "partial";
  isStale: boolean;
  viewer: { staffId: string; name: string };
  summary: { greeting: string; headline: string; tone: "healthy" | "watch" | "risk" };
  metrics: FounderMetric[];
  secondaryMetrics: FounderMetric[];
  changes: Array<{
    id: string;
    type: string;
    title: string;
    explanation: string;
    businessImpact: { amount: number | null; unit: string };
  }>;
  blocked: {
    totalUniqueValue: number;
    categories: Array<{ id: string; uniqueValue: number; orderCount: number }>;
  };
  health: Array<{
    domain: string;
    status: "HEALTHY" | "WATCH" | "AT_RISK";
    reason: string;
  }>;
  issues: Array<{
    id: string;
    severity: string;
    title: string;
    explanation: string;
    businessImpact: { amount: number | null; unit: string };
    owner: string;
  }>;
  pendingDecisions: { count: number; label: string };
}

export type PulseViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; pulse: FounderPulse };

export function pulseViewState(input: {
  loading: boolean;
  error: string | null;
  pulse: FounderPulse | null;
}): PulseViewState {
  if (input.loading && !input.pulse) return { status: "loading" };
  if (input.error && !input.pulse) return { status: "error", message: input.error };
  if (input.pulse) return { status: "ready", pulse: input.pulse };
  return { status: "error", message: "Pulse is unavailable." };
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "permission_required") return "This account is not authorised for Founder.";
  if (message === "authentication_required" || message === "session_required") {
    return "Please sign in again.";
  }
  return "Pulse could not be loaded. Try again in a moment.";
}
