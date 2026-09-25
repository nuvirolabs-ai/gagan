import { inr } from "../theme";
import type { TranslationKey } from "../i18n/translations";

export type TeamTranslate = (
  key: TranslationKey,
  vars?: Record<string, string | number>
) => string;

export interface TeamSalesSummary {
  actual: number;
  target: number | null;
  completionPct: number | null;
}

export interface TeamMemberPresentation {
  summary: TeamSalesSummary;
  attendanceLabel: string;
  attendanceTone: "green" | "warning" | "danger" | "neutral";
  rankLabel: string | null;
  projectionUnavailable: string | null;
  riskReasons: string[];
}

export interface TeamPerformancePresentation {
  team: {
    summary: TeamSalesSummary;
    projectionUnavailable: string | null;
  };
  leaderboardMetricLabel: string;
  members: TeamMemberPresentation[];
  actions: Array<{ actionTitle: string; reason: string }>;
}

export function teamSalesSummary(input: {
  actual: number;
  target?: number | null;
  completionPct?: number | null;
}): TeamSalesSummary {
  const target = typeof input.target === "number" && input.target > 0 ? input.target : null;
  return {
    actual: input.actual,
    target,
    completionPct: target == null ? null : input.completionPct ?? null,
  };
}

type ProjectionFacts = {
  projected?: number | null;
  sellingDays?: { total?: number; elapsed?: number };
};

type LeaderRiskFact =
  | { code: "PROJECTED_ACHIEVEMENT"; values: { projectedAchievementPct: number } }
  | { code: "ROUTE_PROGRESS"; values: { completionPct: number; visited: number; total: number } }
  | { code: "ATTENDANCE_ABSENT"; values: { mark: "absent" } };

type SalesTriggerFact =
  | {
      code: "ORDER_DUE" | "HIGH_VALUE_RETAILER_MISSED";
      usualOrderCycleDays: number;
      daysSinceLastOrder: number;
      recentOrderCount: number;
      typicalOrderValue: number | null;
    }
  | {
      code: "ORDER_VALUE_BELOW_NORMAL";
      typicalOrderValue: number;
      lastOrderValue: number;
      shortfall: number;
      recentOrderCount: number;
    }
  | {
      code: "LINE_ITEMS_BELOW_NORMAL";
      usualLineItems: number;
      lastOrderLineItems: number;
      missingLineItems: number;
      recentOrderCount: number;
    }
  | {
      code: "CATEGORY_REORDER_OPPORTUNITY";
      regularCategories: string[];
      missingCategories: string[];
      recentOrderCount: number;
    }
  | { code: "VISIT_OVERDUE"; daysSinceLastVisit: number; usualOrderCycleDays: number }
  | { code: "COLLECTION_DUE"; overdueAmount: number };

type StructuredReason = LeaderRiskFact | SalesTriggerFact;

const triggerCodes = new Set([
  "ORDER_DUE",
  "VISIT_OVERDUE",
  "HIGH_VALUE_RETAILER_MISSED",
  "ORDER_VALUE_BELOW_NORMAL",
  "LINE_ITEMS_BELOW_NORMAL",
  "COLLECTION_DUE",
  "CATEGORY_REORDER_OPPORTUNITY",
]);

function projectionUnavailable(projection: ProjectionFacts | null | undefined, t: TeamTranslate) {
  if (!projection || projection.projected != null) return null;
  const total = Number(projection.sellingDays?.total ?? 0);
  const elapsed = Number(projection.sellingDays?.elapsed ?? 0);
  if (total <= 0) return t("team.projection.noSellingDays");
  if (elapsed <= 0) return t("team.projection.notStarted");
  return t("team.projection.tooEarly", { elapsed, total });
}

function metricLabel(metric: string | null | undefined, t: TeamTranslate) {
  const keyByMetric: Record<string, TranslationKey> = {
    order_value: "team.metric.orderValue",
    visits: "team.metric.visits",
    order_count: "team.metric.orders",
    collection_value: "team.metric.collections",
    new_customers: "team.metric.newRetailers",
  };
  return t(keyByMetric[metric ?? ""] ?? "team.metric.unknown");
}

function attendancePresentation(mark: string | null | undefined, t: TeamTranslate) {
  const known: Record<string, { key: TranslationKey; tone: "green" | "warning" | "danger" | "neutral" }> = {
    present: { key: "team.attendance.present", tone: "green" },
    leave: { key: "team.attendance.leave", tone: "warning" },
    absent: { key: "team.attendance.absent", tone: "danger" },
    holiday: { key: "team.attendance.holiday", tone: "neutral" },
    not_due: { key: "team.attendance.notDue", tone: "neutral" },
  };
  const presentation = known[mark ?? ""];
  return presentation
    ? { label: t(presentation.key), tone: presentation.tone }
    : { label: t("team.attendance.unknown"), tone: "neutral" as const };
}

function riskReason(fact: LeaderRiskFact | undefined, t: TeamTranslate): string | null {
  if (!fact) return null;
  switch (fact.code) {
    case "PROJECTED_ACHIEVEMENT":
      return t("team.risk.projectedAchievement", {
        pct: fact.values.projectedAchievementPct,
      });
    case "ROUTE_PROGRESS":
      return t("team.risk.routeProgress", {
        pct: fact.values.completionPct,
        visited: fact.values.visited,
        total: fact.values.total,
      });
    case "ATTENDANCE_ABSENT":
      return t("team.risk.attendanceAbsent");
  }
}

function triggerReason(facts: SalesTriggerFact | undefined, t: TeamTranslate): string | null {
  if (!facts) return null;
  switch (facts.code) {
    case "ORDER_DUE":
      return t("team.reason.orderDue", {
        cycle: facts.usualOrderCycleDays,
        daysSince: facts.daysSinceLastOrder,
        orders: facts.recentOrderCount,
        typicalValue: facts.typicalOrderValue == null ? t("team.valueUnavailable") : inr(facts.typicalOrderValue),
      });
    case "HIGH_VALUE_RETAILER_MISSED":
      return t("team.reason.highValueRetailerMissed", {
        cycle: facts.usualOrderCycleDays,
        daysSince: facts.daysSinceLastOrder,
        orders: facts.recentOrderCount,
        typicalValue: facts.typicalOrderValue == null ? t("team.valueUnavailable") : inr(facts.typicalOrderValue),
      });
    case "ORDER_VALUE_BELOW_NORMAL":
      return t("team.reason.orderValueBelowNormal", {
        lastValue: inr(facts.lastOrderValue),
        shortfall: inr(facts.shortfall),
        typicalValue: inr(facts.typicalOrderValue),
        orders: facts.recentOrderCount,
      });
    case "LINE_ITEMS_BELOW_NORMAL":
      return t("team.reason.lineItemsBelowNormal", {
        lastCount: facts.lastOrderLineItems,
        missing: facts.missingLineItems,
        usualCount: facts.usualLineItems,
        orders: facts.recentOrderCount,
      });
    case "CATEGORY_REORDER_OPPORTUNITY":
      return t("team.reason.categoryReorder", {
        regularCategories: facts.regularCategories.join(", "),
        missingCategories: facts.missingCategories.join(", "),
        orders: facts.recentOrderCount,
      });
    case "VISIT_OVERDUE":
      return t("team.reason.visitOverdue", {
        daysSince: facts.daysSinceLastVisit,
        cycle: facts.usualOrderCycleDays,
      });
    case "COLLECTION_DUE":
      return t("team.reason.collectionDue", { amount: inr(facts.overdueAmount) });
    default:
      return null;
  }
}

export function selectTeamPerformancePresentation(
  data: any,
  t: TeamTranslate
): TeamPerformancePresentation {
  const team = data?.team ?? {};
  const metric = metricLabel(data?.leaderboard?.metric, t);
  const members = (data?.members ?? []).map((member: any) => {
    const summary = teamSalesSummary({
      actual: member.headlineTarget?.actual ?? member.actuals?.order_value ?? 0,
      target: member.headlineTarget?.target,
      completionPct: member.headlineTarget?.completionPct,
    });
    const attendance = attendancePresentation(member.attendance, t);
    return {
      summary,
      attendanceLabel: attendance.label,
      attendanceTone: attendance.tone,
      rankLabel: member.rank == null
        ? null
        : t("team.rankByMetric", { rank: member.rank, metric }),
      projectionUnavailable: projectionUnavailable(member.projection, t),
      riskReasons: ((member.riskFacts ?? []) as LeaderRiskFact[])
        .map((fact) => riskReason(fact, t))
        .filter((reason: string | null): reason is string => reason != null),
    };
  });

  const actions = (data?.recommendedActions ?? []).map((action: any) => {
    const details = action.details;
    const values = details?.actionValues ?? {};
    const actionCode = details?.actionCode;
    const reason = details?.reason as StructuredReason | undefined;
    const actionTitle = details?.actionCode === "COACH_AT_RISK"
      ? t("team.action.coach", { salespersonName: values.salespersonName ?? "" })
      : triggerCodes.has(actionCode)
        ? t("team.action.review", {
            salespersonName: values.salespersonName ?? "",
            retailerName: values.retailerName ?? "",
          })
        : t("team.action.unavailable");
    const riskFact = reason?.code === "PROJECTED_ACHIEVEMENT"
      || reason?.code === "ROUTE_PROGRESS"
      || reason?.code === "ATTENDANCE_ABSENT";
    return {
      actionTitle,
      reason: riskFact
        ? riskReason(reason as LeaderRiskFact, t) ?? t("team.reason.unavailable")
        : triggerReason(reason as SalesTriggerFact | undefined, t) ?? t("team.reason.unavailable"),
    };
  });

  return {
    team: {
      summary: teamSalesSummary({
        actual: team.actual ?? 0,
        target: team.target,
        completionPct: team.completionPct,
      }),
      projectionUnavailable: projectionUnavailable(team.projection, t),
    },
    leaderboardMetricLabel: metric,
    members,
    actions,
  };
}
