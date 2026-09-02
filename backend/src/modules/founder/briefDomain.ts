import { percentChange } from "./trendsDomain";

export function moneyVsComparable(label: string, current: number | null, previous: number | null): string | null {
  if (current == null) return null;
  if (previous == null || previous === 0) {
    if (current === 0) return null;
    return `${label} were recorded.`;
  }
  const change = percentChange(current, previous);
  if (change == null) return `${label} were recorded.`;
  if (Math.abs(change) < 5) return `${label} finished in line with the recent weekday average.`;
  if (change > 0) return `${label} finished ${Math.round(change)}% above the recent weekday average.`;
  return `${label} finished ${Math.round(Math.abs(change))}% below the recent weekday average.`;
}

export function fillVsComparable(current: number | null, previous: number | null): string | null {
  if (current == null) return null;
  if (previous == null) return `Fulfilment held at ${Math.round(current)}%.`;
  const delta = current - previous;
  if (Math.abs(delta) < 2) return `Fulfilment held at ${Math.round(current)}%.`;
  if (delta > 0) return `Fulfilment improved to ${Math.round(current)}%.`;
  return `Fulfilment slipped to ${Math.round(current)}%.`;
}

export function largestRisk(issues: Array<{ title: string; businessImpact: { amount: number | null } }>): string | null {
  if (issues.length === 0) return null;
  return `Largest risk: ${issues[0].title}.`;
}

export function largestUnresolved(issues: Array<{ title: string }>): string | null {
  const next = issues.find((issue, index) => index > 0 && issue.title !== issues[0].title);
  if (!next) return null;
  return `Biggest unresolved issue: ${next.title}.`;
}

export function teamConcern(reason: string | null, status: string | null): string | null {
  if (!status || status === "HEALTHY" || !reason) return null;
  return reason;
}

export function pendingDecisionLine(count: number): string | null {
  if (count <= 0) return "No decisions are waiting.";
  return count === 1 ? "One decision needs your attention." : `${count} decisions need your attention.`;
}
