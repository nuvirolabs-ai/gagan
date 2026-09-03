import type { FounderDecision, FounderIssue, FounderTeam, FounderTrend, FounderTrends } from "../api/types";
import { PULSE_FIXTURE } from "../fixtures/pulse";
import { formatAge } from "../format/age";
import { compactInr, formatDelta } from "./format";
import type { FounderPulse } from "./viewState";
import type { FounderPulsePayload, HealthTone, NeedItem } from "./types";

/**
 * CEO board mapping (functions, not new engines).
 *
 * | Board KPI   | Live founder API                         | Staging fixture if missing      |
 * |-------------|------------------------------------------|---------------------------------|
 * | Sales       | pulse.metrics.orders + trends.orders     | 14d / intraday series           |
 * | Payments    | pulse.metrics.collections + trends.coll. | 14d / intraday series           |
 * | Delivery    | pulse.metrics.fillRate + trends.fillRate | pending count, 14d series       |
 * | Present     | (no attendance series on pulse/team)     | on-floor / heat / month %       |
 * | Inventory   | pulse.blocked is constraint capital      | stock value / SKU units         |
 * | Needs you   | decisions (DECIDE) + issues (CRIT)       | chairman mock rows              |
 * | Hub/region  | not on API                               | Indore / West + Central         |
 */
export type LiveFounderBundle = {
  pulse: FounderPulse | null;
  trends7: FounderTrends | null;
  trends30: FounderTrends | null;
  team: FounderTeam | null;
  issues: FounderIssue[];
  decisions: FounderDecision[];
  viewerName?: string;
};

export type ComposeResult = {
  payload: FounderPulsePayload;
  source: "live" | "fixture";
  stagingGaps: string[];
};

function metric(pulse: FounderPulse | null, id: string) {
  return pulse?.metrics.find((row) => row.id === id) ?? pulse?.secondaryMetrics.find((row) => row.id === id);
}

function trend(trends: FounderTrends | null, id: string): FounderTrend | undefined {
  return trends?.trends.find((row) => row.metric === id);
}

function numericPoints(row: FounderTrend | undefined): number[] {
  return (row?.points ?? []).map((point) => point.value).filter((value): value is number => value != null);
}

function lastN(values: number[], n: number): number[] {
  return values.slice(-n);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function signedDelta(delta: { amount: number; direction: "up" | "down" | "flat" } | null | undefined): number | null {
  if (!delta) return null;
  if (delta.direction === "flat") return 0;
  return delta.direction === "down" ? -delta.amount : delta.amount;
}

function pctFromMetric(row: ReturnType<typeof metric>): number | null {
  if (!row || row.value == null || !row.delta) return null;
  if (row.delta.unit === "percent") return signedDelta(row.delta);
  if (row.delta.direction === "flat") return 0;
  const prior = row.delta.direction === "up" ? row.value - row.delta.amount : row.value + row.delta.amount;
  if (prior === 0) return null;
  return ((row.value - prior) / prior) * 100;
}

function pointsDelta(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}

/** Present prior-period total as ghost bars with the current shape — display only, not a new forecast. */
function ghostPrior(current: number[], priorTotal: number | null | undefined): number[] {
  if (current.length === 0) return [];
  const currentSum = sum(current) || 1;
  const total = priorTotal == null ? currentSum : priorTotal;
  return current.map((value) => (value / currentSum) * total);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function firstName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return name.trim().split(/\s+/)[0];
}

function healthFromPulse(tone: FounderPulse["summary"]["tone"] | undefined): { tone: HealthTone; label: string } {
  if (tone === "risk") return { tone: "crit", label: "Risk" };
  if (tone === "watch") return { tone: "amber", label: "Amber" };
  if (tone === "healthy") return { tone: "ok", label: "Healthy" };
  return { tone: "amber", label: "Amber" };
}

function composeNeedsYou(input: LiveFounderBundle): NeedItem[] {
  const items: NeedItem[] = [];
  for (const decision of input.decisions) {
    if (decision.status !== "open") continue;
    items.push({
      kind: "decide",
      title: decision.title || "Credit exception",
      value: decision.amount != null ? compactInr(decision.amount) : "—",
      meta: [decision.requester, formatAge(ageHours(decision.createdAt))].filter(Boolean).join(" · "),
    });
  }
  const issueRows: Array<{
    severity: string;
    title: string;
    explanation: string;
    businessImpact: { amount: number | null; unit: string };
    affectedObjects?: { outbox?: number };
    ageHours?: number | null;
    status?: string;
  }> = [...input.issues, ...(input.issues.length === 0 ? input.pulse?.issues ?? [] : [])];
  for (const issue of issueRows) {
    if (issue.status === "resolved") continue;
    if (issue.severity !== "CRITICAL" && issue.severity !== "HIGH") continue;
    const amount = issue.businessImpact.amount;
    const sap = /sap|outbox/i.test(`${issue.title} ${issue.explanation}`);
    items.push({
      kind: issue.severity === "CRITICAL" || sap ? "crit" : "decide",
      title: issue.title,
      value:
        issue.affectedObjects?.outbox != null
          ? String(issue.affectedObjects.outbox)
          : amount != null
            ? compactInr(amount)
            : "—",
      meta: [issue.explanation.replace(/\.$/, ""), formatAge(issue.ageHours ?? null)].filter(Boolean).join(" · "),
    });
  }
  return items.slice(0, 4);
}

function ageHours(iso: string): number | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.round((Date.now() - then) / 3_600_000));
}

function composeSales(input: LiveFounderBundle, gaps: string[]): FounderPulsePayload["sales"] {
  const fixture = PULSE_FIXTURE.sales;
  const today = metric(input.pulse, "orders");
  const week = trend(input.trends7, "orders");
  const month = trend(input.trends30, "orders");
  const weekPts = numericPoints(week);
  const monthPts = numericPoints(month);
  const series14 = lastN(monthPts.length >= 2 ? monthPts : weekPts, 14);

  if (today?.value == null && week?.currentValue == null && series14.length < 2) {
    gaps.push("sales");
    return fixture;
  }

  const day = today?.value ?? series14[series14.length - 1] ?? fixture.day;
  const dayPct = pctFromMetric(today) ?? week?.comparison?.changePercent ?? fixture.dayPct;
  const weekValue = week?.currentValue ?? (weekPts.length ? sum(weekPts) : fixture.week);
  const weekPct = week?.comparison?.changePercent ?? fixture.weekPct;
  const priorWeek = week?.comparison?.previousValue ?? fixture.priorWeek;
  const monthValue = month?.currentValue ?? (monthPts.length ? sum(monthPts) : fixture.month);
  const monthPct = month?.comparison?.changePercent ?? fixture.monthPct;
  const priorMonth = month?.comparison?.previousValue ?? fixture.priorMonth;

  const liveSeries = series14.length >= 2 ? series14 : fixture.series14;
  if (series14.length < 2) gaps.push("sales.series14");

  const weekCurrent = weekPts.length >= 2 ? weekPts : fixture.weekCurrent;
  const monthCurrent = monthPts.length >= 2 ? monthPts : fixture.monthCurrent;
  if (weekPts.length < 2) gaps.push("sales.weekSeries");
  if (monthPts.length < 2) gaps.push("sales.monthSeries");
  gaps.push("sales.intraday");

  const total14 = series14.length >= 2 ? sum(series14) : fixture.total14;
  const prior14 =
    month?.comparison?.previousValue != null && monthPts.length > 0
      ? month.comparison.previousValue * (Math.min(14, monthPts.length) / monthPts.length)
      : fixture.prior14;

  return {
    total14,
    prior14,
    day,
    week: weekValue,
    priorWeek,
    month: monthValue,
    priorMonth,
    dayPct: round1(dayPct ?? fixture.dayPct),
    weekPct: round1(weekPct ?? fixture.weekPct),
    monthPct: round1(monthPct ?? fixture.monthPct),
    series14: liveSeries,
    weekCurrent,
    weekPrior: ghostPrior(weekCurrent, priorWeek),
    monthCurrent,
    monthPrior: ghostPrior(monthCurrent, priorMonth),
    dayCurrent: fixture.dayCurrent,
    dayPrior: fixture.dayPrior,
  };
}

function composePayments(input: LiveFounderBundle, gaps: string[]): FounderPulsePayload["payments"] {
  const fixture = PULSE_FIXTURE.payments;
  const today = metric(input.pulse, "collections");
  const week = trend(input.trends7, "collections");
  const month = trend(input.trends30, "collections");
  const weekPts = numericPoints(week);
  const monthPts = numericPoints(month);
  const series14 = lastN(monthPts.length >= 2 ? monthPts : weekPts, 14);

  if (today?.value == null && week?.currentValue == null && series14.length < 2) {
    gaps.push("payments");
    return fixture;
  }

  const liveSeries = series14.length >= 2 ? series14 : fixture.series14;
  if (series14.length < 2) gaps.push("payments.series14");
  const weekSeries = weekPts.length >= 2 ? weekPts : fixture.weekSeries;
  const monthSeries = monthPts.length >= 2 ? monthPts : fixture.monthSeries;
  gaps.push("payments.intraday");

  return {
    total14: series14.length >= 2 ? sum(series14) : fixture.total14,
    day: today?.value ?? series14[series14.length - 1] ?? fixture.day,
    week: week?.currentValue ?? (weekPts.length ? sum(weekPts) : fixture.week),
    month: month?.currentValue ?? (monthPts.length ? sum(monthPts) : fixture.month),
    dayPct: round1(pctFromMetric(today) ?? week?.comparison?.changePercent ?? fixture.dayPct),
    weekPct: round1(week?.comparison?.changePercent ?? fixture.weekPct),
    monthPct: round1(month?.comparison?.changePercent ?? fixture.monthPct),
    series14: liveSeries,
    weekSeries,
    monthSeries,
    daySeries: fixture.daySeries,
  };
}

function composeOtif(input: LiveFounderBundle, gaps: string[]): FounderPulsePayload["otif"] {
  const fixture = PULSE_FIXTURE.otif;
  const today = metric(input.pulse, "fillRate");
  const week = trend(input.trends7, "fillRate");
  const month = trend(input.trends30, "fillRate");
  const weekPts = numericPoints(week);
  const monthPts = numericPoints(month);
  const series14 = lastN(monthPts.length >= 2 ? monthPts : weekPts, 14);

  if (today?.value == null && week?.currentValue == null && series14.length < 2) {
    gaps.push("otif");
    return fixture;
  }

  const todayPct = today?.value ?? fixture.todayPct;
  const weekPct = week?.currentValue ?? fixture.weekPct;
  const monthPct = month?.currentValue ?? fixture.monthPct;
  const priorWeek = week?.comparison?.previousValue ?? fixture.priorWeekPct;
  const priorMonth = month?.comparison?.previousValue ?? fixture.priorMonthPct;
  const dayPp = today?.delta?.unit === "points" ? signedDelta(today.delta) ?? fixture.dayPp : fixture.dayPp;
  const weekPpRaw = pointsDelta(weekPct, priorWeek);
  const monthPp = pointsDelta(monthPct, priorMonth) ?? fixture.monthPp;
  if (series14.length < 2) gaps.push("otif.series14");
  gaps.push("otif.pending");

  return {
    todayPct,
    weekPct,
    monthPct,
    priorDayPct: todayPct - dayPp,
    priorWeekPct: priorWeek,
    priorMonthPct: priorMonth,
    dayPp,
    weekPp: weekPpRaw === 0 ? null : weekPpRaw,
    monthPp,
    pending: fixture.pending,
    series14: series14.length >= 2 ? series14 : fixture.series14,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function composeHealth(
  input: LiveFounderBundle,
  present: FounderPulsePayload["present"],
  sales: FounderPulsePayload["sales"],
  needsYou: NeedItem[]
): FounderPulsePayload["health"] {
  const mapped = healthFromPulse(input.pulse?.summary.tone);
  const crit = needsYou.filter((item) => item.kind === "crit").length;
  const salesWord = sales.weekPct >= 0 ? "sales ahead" : "sales behind";
  const detail = `${present.onFloor}/${present.headcount} on floor · ${salesWord} · ${crit} critical`;
  return {
    tone: mapped.tone === "ok" && crit > 0 ? "amber" : mapped.tone,
    label: mapped.tone === "ok" && crit > 0 ? "Amber" : mapped.label,
    detail: input.pulse ? detail : PULSE_FIXTURE.health.detail,
  };
}

function composeTodayReadout(
  present: FounderPulsePayload["present"],
  sales: FounderPulsePayload["sales"],
  payments: FounderPulsePayload["payments"],
  otif: FounderPulsePayload["otif"],
  inventory: FounderPulsePayload["inventory"]
): string {
  const floor =
    present.onFloor / present.headcount >= 0.85 ? "Floor nearly full" : `Floor ${present.onFloor}/${present.headcount}`;
  const salesBit = `sales ${formatDelta("pct", sales.weekPct, 0)} week`;
  const payBit = payments.weekPct >= 0 ? "payments holding" : "payments soft";
  const stockBit = inventory.weekPct < 0 ? "inventory easing" : "inventory steady";
  const otifBit = otif.monthPp < 0 ? "watch OTIF month drift" : "OTIF holding";
  return `${floor}; ${salesBit}; ${payBit}; ${stockBit} — ${otifBit}.`;
}

function composeSeriesReadout(
  sales: FounderPulsePayload["sales"],
  otif: FounderPulsePayload["otif"],
  inventory: FounderPulsePayload["inventory"]
): FounderPulsePayload["readoutSeries"] {
  return {
    day: `Today sales hold the climb; present ${PULSE_FIXTURE.present.onFloor}/${PULSE_FIXTURE.present.headcount}; payments in; OTIF ${Math.round(otif.todayPct)}% — inventory still easing.`,
    week: `Week sales climb holds; present recovering; payments steady; inventory easing — OTIF ${otif.weekPp == null ? "soft vs prior" : formatDelta("pp", otif.weekPp)}, watch month drift.`,
    month: `Month sales ${formatDelta("pct", sales.monthPct, 1)}; payments ${formatDelta("pct", PULSE_FIXTURE.payments.monthPct)}; inventory ${formatDelta("pct", inventory.monthPct)} — OTIF ${Math.round(otif.monthPct)}% is the drift to watch.`,
  };
}

export function composeCeoPayload(input: LiveFounderBundle): ComposeResult {
  if (!input.pulse) {
    return {
      payload: { ...PULSE_FIXTURE, stagingGaps: ["all"] },
      source: "fixture",
      stagingGaps: ["all"],
    };
  }

  const stagingGaps: string[] = ["present", "inventory", "hub", "region"];
  const sales = composeSales(input, stagingGaps);
  const payments = composePayments(input, stagingGaps);
  const otif = composeOtif(input, stagingGaps);
  const present = { ...PULSE_FIXTURE.present };
  const inventory = { ...PULSE_FIXTURE.inventory };
  const liveNeeds = composeNeedsYou(input);
  const needsYou = liveNeeds.length > 0 ? liveNeeds : PULSE_FIXTURE.needsYou;
  if (liveNeeds.length === 0) stagingGaps.push("needsYou");

  const payload: FounderPulsePayload = {
    asOf: input.pulse.asOf,
    viewerName: firstName(input.pulse.viewer.name) ?? firstName(input.viewerName) ?? PULSE_FIXTURE.viewerName,
    hub: PULSE_FIXTURE.hub,
    regionLabel: PULSE_FIXTURE.regionLabel,
    health: composeHealth(input, present, sales, needsYou),
    present,
    sales,
    otif,
    payments,
    inventory,
    needsYou,
    readoutToday: composeTodayReadout(present, sales, payments, otif, inventory),
    readoutSeries: composeSeriesReadout(sales, otif, inventory),
    stagingGaps: unique(stagingGaps),
  };

  return { payload, source: "live", stagingGaps: unique(stagingGaps) };
}

export function isCeoPulsePayload(value: unknown): value is FounderPulsePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as FounderPulsePayload;
  return Boolean(payload.sales && payload.present && payload.otif && payload.payments && payload.inventory && payload.health);
}
