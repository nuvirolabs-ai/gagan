import { describe, expect, it } from "vitest";
import {
  METRIC_DEFINITIONS,
  TARGET_METRICS,
  buildProgress,
  formatMetric,
  periodPace,
  remainingSentence,
  resolveStatus,
} from "../targetDomain";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const MARCH = { periodStart: day("2026-03-01"), periodEnd: day("2026-03-31") };

describe("metric catalogue", () => {
  it("gives every metric a definition and a stated source", () => {
    for (const metric of TARGET_METRICS) {
      const definition = METRIC_DEFINITIONS[metric];
      expect(definition.metric).toBe(metric);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.source.length).toBeGreaterThan(0);
      expect(definition.remainingTemplate).toContain("{{n}}");
    }
  });
});

describe("progress arithmetic", () => {
  it("reports target, actual, remaining and completion", () => {
    const progress = buildProgress({ metric: "order_value", target: 120000, actual: 78400, ...MARCH });
    expect(progress).toMatchObject({
      target: 120000,
      actual: 78400,
      remaining: 41600,
      completionPct: 65,
      unit: "currency",
    });
  });

  it("never reports negative work left once the target is beaten", () => {
    const progress = buildProgress({ metric: "order_count", target: 10, actual: 14, ...MARCH });
    expect(progress.remaining).toBe(0);
    // Completion is uncapped so beating a target stays visible.
    expect(progress.completionPct).toBe(140);
    expect(progress.status).toBe("exceeded");
  });

  it("treats exactly meeting the target as achieved, not exceeded", () => {
    const progress = buildProgress({ metric: "line_items", target: 40, actual: 40, ...MARCH });
    expect(progress).toMatchObject({ remaining: 0, completionPct: 100, status: "achieved" });
  });

  it("handles a zero target without dividing by it", () => {
    const progress = buildProgress({ metric: "visits", target: 0, actual: 5, ...MARCH });
    expect(progress).toMatchObject({ completionPct: 0, remaining: 0, status: "not_started" });
    expect(Number.isFinite(progress.completionPct)).toBe(true);
    expect(remainingSentence(progress)).toBe("No target set for this period.");
  });

  it("clamps a nonsensical negative actual to zero", () => {
    expect(buildProgress({ metric: "visits", target: 10, actual: -3, ...MARCH }).actual).toBe(0);
  });

  it("carries the period boundaries it was measured over", () => {
    const progress = buildProgress({ metric: "visits", target: 10, actual: 1, ...MARCH });
    expect(progress.periodStart).toBe("2026-03-01");
    expect(progress.periodEnd).toBe("2026-03-31");
  });
});

describe("status against the period's pace", () => {
  it("is on track when ahead of the pace the period demands", () => {
    // Half the month gone, more than half the target done.
    expect(resolveStatus(100, 60, 0.5)).toBe("on_track");
  });

  it("is behind when short of that pace", () => {
    expect(resolveStatus(100, 30, 0.5)).toBe("behind");
  });

  it("does not call day one behind", () => {
    expect(resolveStatus(100, 4, 1 / 31)).toBe("on_track");
  });

  it("says nothing started when nothing has been done", () => {
    expect(resolveStatus(100, 0, 0.5)).toBe("not_started");
  });

  it("falls back to on track when the pace is unknown", () => {
    expect(resolveStatus(100, 30)).toBe("on_track");
  });
});

describe("the sentence a salesperson reads", () => {
  it("says how much is left in the metric's own words", () => {
    expect(
      remainingSentence(buildProgress({ metric: "order_value", target: 120000, actual: 78400, ...MARCH }))
    ).toBe("₹41,600 more to go");
    expect(
      remainingSentence(buildProgress({ metric: "productive_outlets", target: 12, actual: 9, ...MARCH }))
    ).toBe("3 more stores");
    expect(
      remainingSentence(buildProgress({ metric: "line_items", target: 40, actual: 32, ...MARCH }))
    ).toBe("8 more lines");
  });

  it("celebrates a completed target without a number to chase", () => {
    expect(
      remainingSentence(buildProgress({ metric: "visits", target: 10, actual: 10, ...MARCH }))
    ).toBe("Target complete.");
  });

  it("says by how much a beaten target was beaten", () => {
    expect(
      remainingSentence(buildProgress({ metric: "order_value", target: 100000, actual: 130000, ...MARCH }))
    ).toBe("Target beaten — 130% of ₹1,00,000.");
  });
});

describe("money and counts read the way the apps display them", () => {
  it("groups rupees the Indian way", () => {
    expect(formatMetric(120000, "currency")).toBe("₹1,20,000");
    expect(formatMetric(4100000, "currency")).toBe("₹41,00,000");
  });

  it("keeps counts plain", () => {
    expect(formatMetric(12, "count")).toBe("12");
  });
});

describe("period pace", () => {
  it("counts an inclusive month", () => {
    expect(periodPace(day("2026-03-01"), day("2026-03-31"), day("2026-03-01"))).toMatchObject({
      totalDays: 31,
      elapsedDays: 1,
      remainingDays: 30,
    });
  });

  it("treats the last day as fully elapsed", () => {
    const pace = periodPace(day("2026-03-01"), day("2026-03-31"), day("2026-03-31"));
    expect(pace).toMatchObject({ elapsedDays: 31, remainingDays: 0, elapsedFraction: 1 });
  });

  it("does not run past the end of a finished period", () => {
    const pace = periodPace(day("2026-03-01"), day("2026-03-31"), day("2026-04-15"));
    expect(pace).toMatchObject({ elapsedDays: 31, remainingDays: 0, elapsedFraction: 1 });
  });

  it("reports nothing elapsed before the period starts", () => {
    const pace = periodPace(day("2026-03-01"), day("2026-03-31"), day("2026-02-20"));
    expect(pace).toMatchObject({ elapsedDays: 0, elapsedFraction: 0 });
  });

  it("handles a single-day period", () => {
    expect(periodPace(day("2026-03-10"), day("2026-03-10"), day("2026-03-10"))).toMatchObject({
      totalDays: 1,
      elapsedDays: 1,
      elapsedFraction: 1,
    });
  });
});
