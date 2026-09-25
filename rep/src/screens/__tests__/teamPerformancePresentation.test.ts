import { describe, expect, it } from "vitest";
import { selectTeamPerformancePresentation, teamSalesSummary } from "../teamPerformancePresentation";
import { translate, type TranslationKey } from "../../i18n/translations";

const t = (language: "en" | "hi") =>
  (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars);

describe("team sales summary", () => {
  it.each([null, 0, -1, undefined])("keeps actual sales visible without a positive target (%s)", (target) => {
    expect(teamSalesSummary({ actual: 18400, target, completionPct: 0 })).toEqual({
      actual: 18400,
      target: null,
      completionPct: null,
    });
  });

  it("preserves the canonical completion percentage for a positive target", () => {
    expect(teamSalesSummary({ actual: 18400, target: 50000, completionPct: 37 })).toEqual({
      actual: 18400,
      target: 50000,
      completionPct: 37,
    });
  });
});

describe("team performance presentation", () => {
  it.each(["en", "hi"] as const)("keeps hosted team KPIs and accessible labels in %s", (language) => {
    const view = selectTeamPerformancePresentation({
      team: { salespeople: 1, present: 1, visits: 12, orders: 3, collections: 42500 },
    }, t(language));

    expect(view.team.kpis).toEqual([
      { label: t(language)("team.presentToday"), value: "1 / 1" },
      { label: t(language)("team.visits"), value: "12" },
      { label: t(language)("team.orders"), value: "3" },
      { label: t(language)("team.collections"), value: "₹42,500" },
    ]);
  });

  it("localizes all attendance states and keeps unknown marks distinct from absence", () => {
    const marks = ["present", "leave", "absent", "holiday", "not_due", "future_mark"];
    for (const language of ["en", "hi"] as const) {
      const view = selectTeamPerformancePresentation({
        members: marks.map((attendance) => ({ attendance })),
      }, t(language));

      expect(view.members.map((member) => member.attendanceLabel)).toEqual([
        t(language)("team.attendance.present"),
        t(language)("team.attendance.leave"),
        t(language)("team.attendance.absent"),
        t(language)("team.attendance.holiday"),
        t(language)("team.attendance.notDue"),
        t(language)("team.attendance.unknown"),
      ]);
      expect(view.members[5].attendanceLabel).not.toBe(view.members[2].attendanceLabel);
    }
  });

  it("localizes leaderboard metric and includes it beside member rank", () => {
    const view = selectTeamPerformancePresentation({
      leaderboard: { metric: "order_value", metricLabel: "Generated English label" },
      members: [{ rank: 2, attendance: "present" }],
    }, t("hi"));

    expect(view.leaderboardMetricLabel).toBe(t("hi")("team.metric.orderValue"));
    expect(view.members[0].rankLabel).toBe(
      t("hi")("team.rankByMetric", { rank: 2, metric: t("hi")("team.metric.orderValue") })
    );
    expect(view.leaderboardMetricLabel).not.toBe("Generated English label");
  });

  it("labels a target-achievement ranking with its actual metric", () => {
    const view = selectTeamPerformancePresentation({
      leaderboard: { metric: "target_achievement_pct", metricLabel: "Generated English label" },
      members: [{ rank: 1, attendance: "present" }],
    }, t("en"));

    expect(view.leaderboardMetricLabel).toBe(t("en")("team.metric.targetAchievement"));
    expect(view.members[0].rankLabel).toBe(
      t("en")("team.rankByMetric", { rank: 1, metric: t("en")("team.metric.targetAchievement") })
    );
  });

  it("uses sales actuals and never presents a non-sales target as a sales target", () => {
    const view = selectTeamPerformancePresentation({
      members: [{
        attendance: "present",
        actuals: { order_value: 18400, visits: 8 },
        headlineTarget: { metric: "visits", actual: 8, target: 20, completionPct: 40 },
      }],
    }, t("en"));

    expect(view.members[0].summary).toEqual({ actual: 18400, target: null, completionPct: null });
  });

  it("does not claim the period has no selling days when an empty team cannot be projected", () => {
    const view = selectTeamPerformancePresentation({
      team: {
        salespeople: 0,
        projection: { projected: null, sellingDays: { total: 0, elapsed: 0, remaining: 0 } },
      },
    }, t("en"));

    expect(view.team.projectionUnavailable).toBe(t("en")("team.projection.noTeamSales"));
  });

  it("explains every unavailable projection state from selling-day facts", () => {
    const view = selectTeamPerformancePresentation({
      team: {
        projection: { projected: null, sellingDays: { total: 0, elapsed: 0, remaining: 0 }, unavailableReason: "Ignore this English." },
      },
      members: [
        { attendance: "present", projection: { projected: null, sellingDays: { total: 31, elapsed: 0, remaining: 31 } } },
        { attendance: "present", projection: { projected: null, sellingDays: { total: 31, elapsed: 3, remaining: 28 } } },
      ],
    }, t("hi"));

    expect(view.team.projectionUnavailable).toBe(t("hi")("team.projection.noSellingDays"));
    expect(view.members[0].projectionUnavailable).toBe(t("hi")("team.projection.notStarted"));
    expect(view.members[1].projectionUnavailable).toBe(
      t("hi")("team.projection.tooEarly", { elapsed: 3, total: 31 })
    );
  });

  it("renders risk facts in Hindi instead of using generated English reasons", () => {
    const view = selectTeamPerformancePresentation({
      members: [{
        attendance: "absent",
        risk: { reasons: ["DO NOT RENDER THIS RAW ENGLISH"] },
        riskFacts: [
          { code: "PROJECTED_ACHIEVEMENT", values: { projectedAchievementPct: 31 } },
          { code: "ROUTE_PROGRESS", values: { completionPct: 40, visited: 2, total: 5 } },
          { code: "ATTENDANCE_ABSENT", values: { mark: "absent" } },
        ],
      }],
    }, t("hi"));

    expect(view.members[0].riskReasons).toEqual([
      t("hi")("team.risk.projectedAchievement", { pct: 31 }),
      t("hi")("team.risk.routeProgress", { pct: 40, visited: 2, total: 5 }),
      t("hi")("team.risk.attendanceAbsent"),
    ]);
    expect(view.members[0].riskReasons.join(" ")).not.toContain("DO NOT RENDER");
  });

  it("renders every opportunity code from structured values in both languages", () => {
    const actions = [
      {
        type: "COACH_AT_RISK",
        action: "DO NOT RENDER ACTION",
        why: "DO NOT RENDER REASON",
        details: {
          actionCode: "COACH_AT_RISK",
          actionValues: { salespersonName: "Bela" },
          reason: { code: "PROJECTED_ACHIEVEMENT", values: { projectedAchievementPct: 31 } },
        },
      },
      {
        type: "REVIEW_ORDER_DUE",
        action: "DO NOT RENDER ACTION",
        why: "DO NOT RENDER REASON",
        details: {
          actionCode: "ORDER_DUE",
          actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
          reason: { code: "ORDER_DUE", usualOrderCycleDays: 12, daysSinceLastOrder: 19, recentOrderCount: 5, typicalOrderValue: 22400 },
        },
      },
      {
        type: "REVIEW_HIGH_VALUE_RETAILER_MISSED",
        details: {
          actionCode: "HIGH_VALUE_RETAILER_MISSED",
          actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
          reason: { code: "HIGH_VALUE_RETAILER_MISSED", usualOrderCycleDays: 12, daysSinceLastOrder: 19, recentOrderCount: 5, typicalOrderValue: null },
        },
      },
      {
        type: "REVIEW_ORDER_VALUE_BELOW_NORMAL",
        details: {
          actionCode: "ORDER_VALUE_BELOW_NORMAL",
          actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
          reason: { code: "ORDER_VALUE_BELOW_NORMAL", typicalOrderValue: 10000, lastOrderValue: 4000, shortfall: 6000, recentOrderCount: 4 },
        },
      },
      {
        type: "REVIEW_LINE_ITEMS_BELOW_NORMAL",
        details: {
          actionCode: "LINE_ITEMS_BELOW_NORMAL",
          actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
          reason: { code: "LINE_ITEMS_BELOW_NORMAL", usualLineItems: 8, lastOrderLineItems: 3, missingLineItems: 5, recentOrderCount: 4 },
        },
      },
      {
        type: "REVIEW_CATEGORY_REORDER_OPPORTUNITY",
        details: {
          actionCode: "CATEGORY_REORDER_OPPORTUNITY",
          actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
          reason: { code: "CATEGORY_REORDER_OPPORTUNITY", regularCategories: ["Daal", "Rice"], missingCategories: ["Daal"], recentOrderCount: 4 },
        },
      },
      {
        type: "REVIEW_VISIT_OVERDUE",
        details: {
          actionCode: "VISIT_OVERDUE",
          actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
          reason: { code: "VISIT_OVERDUE", daysSinceLastVisit: 18, usualOrderCycleDays: 12 },
        },
      },
      {
        type: "REVIEW_COLLECTION_DUE",
        details: {
          actionCode: "COLLECTION_DUE",
          actionValues: { salespersonName: "Bela", retailerName: "Sharma Stores" },
          reason: { code: "COLLECTION_DUE", overdueAmount: 42000 },
        },
      },
    ];
    const data = {
      recommendedActions: actions,
      members: [],
    };
    const english = selectTeamPerformancePresentation(data, t("en"));
    const hindi = selectTeamPerformancePresentation(data, t("hi"));

    expect(english.actions).toHaveLength(actions.length);
    expect(hindi.actions).toHaveLength(actions.length);
    for (const [index, action] of actions.entries()) {
      expect(english.actions[index].actionTitle).not.toContain("DO NOT RENDER");
      expect(english.actions[index].reason).not.toContain("DO NOT RENDER");
      expect(hindi.actions[index].actionTitle).not.toBe(english.actions[index].actionTitle);
      expect(hindi.actions[index].reason).not.toBe(english.actions[index].reason);
      if (action.details.actionCode !== "COACH_AT_RISK") {
        expect(english.actions[index].actionTitle).toContain("Sharma Stores");
      }
      if (action.details.reason.code === "CATEGORY_REORDER_OPPORTUNITY") {
        expect(english.actions[index].reason).toContain("Daal");
        expect(hindi.actions[index].reason).toContain("Daal");
      }
      if (action.details.reason.code === "ORDER_DUE") {
        expect(english.actions[index].reason).toContain("12");
        expect(english.actions[index].reason).toContain("19");
        expect(english.actions[index].reason).toContain("5");
        expect(english.actions[index].reason).toContain("₹22,400");
      }
      if (action.details.reason.code === "ORDER_VALUE_BELOW_NORMAL") {
        expect(english.actions[index].reason).toContain("₹10,000");
        expect(english.actions[index].reason).toContain("₹4,000");
        expect(english.actions[index].reason).toContain("₹6,000");
      }
      if (action.details.reason.code === "LINE_ITEMS_BELOW_NORMAL") {
        expect(english.actions[index].reason).toContain("8");
        expect(english.actions[index].reason).toContain("3");
        expect(english.actions[index].reason).toContain("5");
      }
      if (action.details.reason.code === "VISIT_OVERDUE") {
        expect(english.actions[index].reason).toContain("18");
        expect(english.actions[index].reason).toContain("12");
      }
      if (action.details.reason.code === "COLLECTION_DUE") {
        expect(english.actions[index].reason).toContain("₹42,000");
        expect(hindi.actions[index].reason).toContain("₹42,000");
      }
    }
  });

  it("uses actuals and canonical positive-target progress for both team and members", () => {
    const view = selectTeamPerformancePresentation({
      team: { actual: 97200, target: 100000, completionPct: 97 },
      members: [
        { attendance: "present", actuals: { order_value: 18400 }, headlineTarget: { metric: "order_value", actual: 18400, target: 50000, completionPct: 37 } },
        { attendance: "present", actuals: { order_value: 7600 }, headlineTarget: null },
      ],
    }, t("en"));

    expect(view.team.summary).toEqual({ actual: 97200, target: 100000, completionPct: 97 });
    expect(view.members.map((member) => member.summary)).toEqual([
      { actual: 18400, target: 50000, completionPct: 37 },
      { actual: 7600, target: null, completionPct: null },
    ]);
  });
});
