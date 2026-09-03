import { describe, expect, it } from "vitest";
import { PULSE_VISUAL_FIXTURE } from "../../fixtures/pulseVisual";
import { lakhs } from "../format";
import { mapTodayBoard } from "../mapPulse";
import { composeCeoPayload } from "../composeCeo";
import type { FounderTrend, FounderTrends } from "../../api/types";

function trend(metric: string, current: number, previous: number, points: number[], period: "7D" | "30D" = "7D"): FounderTrend {
  const changePercent = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 1000) / 10;
  return {
    metric,
    label: metric,
    unit: metric === "fillRate" ? "percent" : "inr",
    period,
    points: points.map((value, index) => ({ date: `2026-08-${String(10 + index).padStart(2, "0")}`, value })),
    currentValue: current,
    availability: "available",
    comparison: {
      previousValue: previous,
      changePercent,
      direction: current > previous ? "up" : current < previous ? "down" : "flat",
      label: `${changePercent}%`,
    },
    interpretation: "",
    asOf: PULSE_VISUAL_FIXTURE.asOf,
    sourceStatus: "ok",
    isStale: false,
  };
}

function wrap(period: "7D" | "30D", rows: FounderTrend[]): FounderTrends {
  return {
    asOf: PULSE_VISUAL_FIXTURE.asOf,
    period,
    sourceStatus: "ok",
    isStale: false,
    trends: rows,
  };
}

describe("composeCeoPayload", () => {
  const weekOrders = [2.2, 2.32, 2.48, 2.65, 2.82, 2.95, 2.98].map(lakhs);
  const weekCollections = [1.7, 1.82, 1.9, 2.0, 2.12, 2.22, 2.34].map(lakhs);
  const weekFill = [84, 85, 86, 86, 87, 86, 86];

  const composed = composeCeoPayload({
    pulse: PULSE_VISUAL_FIXTURE,
    trends7: wrap("7D", [
      trend("orders", lakhs(18.4), lakhs(17.0), weekOrders),
      trend("collections", lakhs(14.1), lakhs(13.7), weekCollections),
      trend("fillRate", 86, 86, weekFill),
    ]),
    trends30: wrap("30D", [
      trend("orders", lakhs(78.2), lakhs(74.7), [...weekOrders, ...weekOrders].slice(0, 14), "30D"),
      trend("collections", lakhs(58.6), lakhs(55.8), [...weekCollections, ...weekCollections].slice(0, 14), "30D"),
      trend("fillRate", 84, 86, [...weekFill, ...weekFill].slice(0, 14), "30D"),
    ]),
    team: null,
    issues: [],
    decisions: [
      {
        id: "d1",
        type: "CREDIT_EXCEPTION",
        title: "Credit exception",
        amount: 78_000,
        requester: "Executive Store",
        owner: "Credit",
        context: [],
        recommendation: "REVIEW",
        recommendedBy: "system",
        recommendationReason: "",
        availableActions: ["approve", "decline"],
        unavailableActions: [],
        createdAt: new Date(Date.now() - 16 * 3600_000).toISOString(),
        dueAt: null,
        status: "open",
        auditRequired: false,
      },
    ],
  });

  it("maps orders/collections/fill into Sales/Payments/Delivery and never ships those old labels on the board", () => {
    const board = mapTodayBoard(composed.payload, composed.source);
    expect(composed.source).toBe("live");
    expect(composed.payload.sales.day).toBe(124_800);
    expect(composed.payload.payments.day).toBe(27_100);
    expect(composed.payload.otif.todayPct).toBe(90);
    expect(composed.payload.sales.week).toBe(lakhs(18.4));
    expect(board.tiles.map((tile) => tile.title)).toEqual([
      "Present · LIVE",
      "Delivery · OTIF",
      "Payments In",
      "Inventory",
    ]);
    expect(JSON.stringify(board.tiles.map((tile) => tile.title))).not.toMatch(/Orders|Collections|Fill rate|Blocked/);
    expect(board.period.map((row) => row.name)).toEqual(["Present", "Sales", "Delivery", "Payments", "Inventory"]);
  });

  it("labels Present and Inventory as staging fixtures when those aggregates are not on the API", () => {
    expect(composed.stagingGaps).toEqual(expect.arrayContaining(["present", "inventory", "hub", "region"]));
    expect(composed.payload.present.onFloor).toBe(38);
    expect(composed.payload.inventory.value).toBe(1.84 * 1_00_00_000);
    expect(composed.payload.needsYou[0]).toMatchObject({ kind: "decide", title: "Credit exception" });
  });

  it("falls back to the locked fixture when pulse is missing", () => {
    const empty = composeCeoPayload({
      pulse: null,
      trends7: null,
      trends30: null,
      team: null,
      issues: [],
      decisions: [],
    });
    expect(empty.source).toBe("fixture");
    expect(mapTodayBoard(empty.payload, "fixture").salesHero.value).toBe("₹42.6L");
  });
});
