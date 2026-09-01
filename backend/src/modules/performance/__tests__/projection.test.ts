import { describe, expect, it } from "vitest";
import {
  AT_RISK_PCT,
  MIN_ELAPSED_FRACTION_FOR_PROJECTION,
  PROJECTION_LABEL,
  assessRisk,
  project,
  sellingDaysIn,
} from "../projectionDomain";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("counting selling days", () => {
  it("counts every calendar day when no calendar says otherwise", () => {
    expect(
      sellingDaysIn({ periodStart: day("2026-03-01"), periodEnd: day("2026-03-31"), now: day("2026-03-10") })
    ).toEqual({ total: 31, elapsed: 10, remaining: 21 });
  });

  it("skips the days the working calendar excludes", () => {
    const nonWorking = new Set(["2026-03-07", "2026-03-08", "2026-03-14", "2026-03-15"]);
    const days = sellingDaysIn({
      periodStart: day("2026-03-01"),
      periodEnd: day("2026-03-31"),
      now: day("2026-03-10"),
      nonWorkingDays: nonWorking,
    });
    expect(days.total).toBe(27);
    expect(days.elapsed).toBe(8);
  });

  it("counts the whole period once it is over", () => {
    const days = sellingDaysIn({
      periodStart: day("2026-03-01"),
      periodEnd: day("2026-03-31"),
      now: day("2026-04-10"),
    });
    expect(days).toEqual({ total: 31, elapsed: 31, remaining: 0 });
  });

  it("counts nothing elapsed before the period begins", () => {
    expect(
      sellingDaysIn({ periodStart: day("2026-03-01"), periodEnd: day("2026-03-31"), now: day("2026-02-01") })
        .elapsed
    ).toBe(0);
  });
});

describe("projecting", () => {
  it("extends the pace so far across the whole period", () => {
    const projection = project({
      actual: 100000,
      sellingDays: { total: 30, elapsed: 10, remaining: 20 },
    });
    expect(projection.projected).toBe(300000);
    expect(projection.perDay).toBe(10000);
    expect(projection.label).toBe(PROJECTION_LABEL);
  });

  it("refuses to project from too little of the period, and says why", () => {
    const projection = project({
      actual: 50000,
      sellingDays: { total: 30, elapsed: 2, remaining: 28 },
    });
    expect(projection.projected).toBeNull();
    expect(projection.unavailableReason).toContain("Too early to project");
  });

  it("projects exactly at the threshold", () => {
    const elapsed = 30 * MIN_ELAPSED_FRACTION_FOR_PROJECTION;
    expect(
      project({ actual: 60000, sellingDays: { total: 30, elapsed, remaining: 30 - elapsed } }).projected
    ).toBe(300000);
  });

  it("says the period has not started rather than dividing by zero", () => {
    const projection = project({ actual: 0, sellingDays: { total: 30, elapsed: 0, remaining: 30 } });
    expect(projection.projected).toBeNull();
    expect(projection.unavailableReason).toBe("The period has not started.");
  });

  it("handles a period with no selling days at all", () => {
    expect(
      project({ actual: 0, sellingDays: { total: 0, elapsed: 0, remaining: 0 } }).unavailableReason
    ).toBe("No selling days in this period.");
  });

  it("projects a finished period to what actually happened", () => {
    expect(
      project({ actual: 280000, sellingDays: { total: 30, elapsed: 30, remaining: 0 } }).projected
    ).toBe(280000);
  });
});

describe("risk", () => {
  it("flags a team projected well short of target", () => {
    const risk = assessRisk({ target: 1000000, projected: 820000 });
    expect(risk.level).toBe("at_risk");
    expect(risk.projectedAchievementPct).toBe(82);
    expect(risk.reasons[0]).toBe("projected at current run rate: 82% of target.");
  });

  it("watches a team a little short", () => {
    expect(assessRisk({ target: 1000000, projected: 900000 }).level).toBe("watch");
  });

  it("leaves a team on pace alone", () => {
    const risk = assessRisk({ target: 1000000, projected: 1010000 });
    expect(risk.level).toBe("on_track");
    expect(risk.reasons).toEqual([]);
  });

  it("keeps the reasons it was given alongside the projection", () => {
    const risk = assessRisk({
      target: 1000000,
      projected: 700000,
      reasons: ["7 high-value retailers have not ordered this cycle."],
    });
    expect(risk.reasons).toEqual([
      "projected at current run rate: 70% of target.",
      "7 high-value retailers have not ordered this cycle.",
    ]);
  });

  it("does not judge a team with no target or no projection", () => {
    expect(assessRisk({ target: 0, projected: 500 }).level).toBe("on_track");
    expect(assessRisk({ target: 1000, projected: null }).projectedAchievementPct).toBeNull();
  });

  it("switches exactly at the at-risk threshold", () => {
    expect(assessRisk({ target: 100, projected: AT_RISK_PCT }).level).toBe("watch");
    expect(assessRisk({ target: 100, projected: AT_RISK_PCT - 1 }).level).toBe("at_risk");
  });
});
