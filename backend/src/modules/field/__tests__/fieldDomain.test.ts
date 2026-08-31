import { describe, expect, it } from "vitest";
import {
  compareTargets,
  dateWithinRange,
  eachDay,
  isProductiveVisit,
  nextStop,
  resolveAttendanceMark,
  resolveTrackingState,
  routeProgress,
  shouldRecordPing,
  startOfDay,
  workedMinutes,
} from "../fieldDomain";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("attendance marks", () => {
  const base = { date: day("2026-03-10"), today: day("2026-03-12"), isWorkingDay: true };

  it("marks a day present when the salesperson opened a workday", () => {
    expect(
      resolveAttendanceMark({ ...base, hasWorkday: true, onApprovedLeave: false })
    ).toBe("present");
  });

  it("prefers the workday over an approved leave that was worked anyway", () => {
    expect(
      resolveAttendanceMark({ ...base, hasWorkday: true, onApprovedLeave: true })
    ).toBe("present");
  });

  it("marks approved leave", () => {
    expect(
      resolveAttendanceMark({ ...base, hasWorkday: false, onApprovedLeave: true })
    ).toBe("leave");
  });

  it("marks a non-working day as a holiday rather than an absence", () => {
    expect(
      resolveAttendanceMark({ ...base, hasWorkday: false, onApprovedLeave: false, isWorkingDay: false })
    ).toBe("holiday");
  });

  it("never marks a future working day absent", () => {
    expect(
      resolveAttendanceMark({
        ...base,
        date: day("2026-03-20"),
        hasWorkday: false,
        onApprovedLeave: false,
      })
    ).toBe("not_due");
  });

  it("marks today absent only once it is today or earlier", () => {
    expect(
      resolveAttendanceMark({ ...base, date: day("2026-03-12"), hasWorkday: false, onApprovedLeave: false })
    ).toBe("absent");
  });
});

describe("worked minutes", () => {
  it("floors partial minutes", () => {
    expect(
      workedMinutes(new Date("2026-03-10T09:00:00Z"), new Date("2026-03-10T17:30:45Z"))
    ).toBe(510);
  });

  it("never returns a negative duration", () => {
    expect(
      workedMinutes(new Date("2026-03-10T17:00:00Z"), new Date("2026-03-10T09:00:00Z"))
    ).toBe(0);
  });
});

describe("date helpers", () => {
  it("normalises to UTC midnight", () => {
    expect(startOfDay(new Date("2026-03-10T18:45:00Z")).toISOString()).toBe(
      "2026-03-10T00:00:00.000Z"
    );
  });

  it("enumerates an inclusive range", () => {
    expect(eachDay(day("2026-03-10"), day("2026-03-12")).map((d) => d.toISOString())).toEqual([
      "2026-03-10T00:00:00.000Z",
      "2026-03-11T00:00:00.000Z",
      "2026-03-12T00:00:00.000Z",
    ]);
  });

  it("treats leave ranges as inclusive on both ends", () => {
    expect(dateWithinRange(day("2026-03-10"), day("2026-03-10"), day("2026-03-12"))).toBe(true);
    expect(dateWithinRange(day("2026-03-12"), day("2026-03-10"), day("2026-03-12"))).toBe(true);
    expect(dateWithinRange(day("2026-03-13"), day("2026-03-10"), day("2026-03-12"))).toBe(false);
  });
});

describe("tracking state", () => {
  it("tracks only while a workday is open, with policy on and permission granted", () => {
    expect(
      resolveTrackingState({ policyEnabled: true, workdayOpen: true, permissionGranted: true })
    ).toEqual({ tracking: true, reason: "tracking_active" });
  });

  it("does not track off duty", () => {
    expect(
      resolveTrackingState({ policyEnabled: true, workdayOpen: false, permissionGranted: true })
    ).toEqual({ tracking: false, reason: "off_duty" });
  });

  it("reports the policy switch ahead of anything else", () => {
    expect(
      resolveTrackingState({ policyEnabled: false, workdayOpen: true, permissionGranted: true })
    ).toEqual({ tracking: false, reason: "policy_disabled" });
  });

  it("reports a missing device permission", () => {
    expect(
      resolveTrackingState({ policyEnabled: true, workdayOpen: true, permissionGranted: false })
    ).toEqual({ tracking: false, reason: "permission_required" });
  });
});

describe("ping sampling", () => {
  const now = new Date("2026-03-10T10:00:00Z");
  const base = { now, intervalSeconds: 300, accuracyMeters: 20, maxAccuracyMeters: 50 };

  it("records the first ping of a day", () => {
    expect(shouldRecordPing({ ...base, lastRecordedAt: null })).toBe(true);
  });

  it("drops readings inside the sampling interval", () => {
    expect(
      shouldRecordPing({ ...base, lastRecordedAt: new Date("2026-03-10T09:57:00Z") })
    ).toBe(false);
  });

  it("drops readings the device calls unreliable", () => {
    expect(
      shouldRecordPing({ ...base, lastRecordedAt: null, accuracyMeters: 400 })
    ).toBe(false);
    expect(shouldRecordPing({ ...base, lastRecordedAt: null, accuracyMeters: 0 })).toBe(false);
  });

  it("drops a stationary phone once the interval has passed", () => {
    expect(
      shouldRecordPing({
        ...base,
        lastRecordedAt: new Date("2026-03-10T09:50:00Z"),
        movedMeters: 4,
      })
    ).toBe(false);
  });

  it("records real movement after the interval", () => {
    expect(
      shouldRecordPing({
        ...base,
        lastRecordedAt: new Date("2026-03-10T09:50:00Z"),
        movedMeters: 800,
      })
    ).toBe(true);
  });
});

describe("visit productivity", () => {
  it("counts an order outcome", () => {
    expect(isProductiveVisit({ outcome: "order_placed" })).toBe(true);
  });

  it("counts a collection logged as an activity", () => {
    expect(
      isProductiveVisit({ outcome: "other", activityTypes: ["stock_check", "collection_completed"] })
    ).toBe(true);
  });

  it("does not count a conversation on its own", () => {
    expect(
      isProductiveVisit({ outcome: "no_order", activityTypes: ["order_discussion", "note"] })
    ).toBe(false);
  });
});

describe("route progress", () => {
  const stops = [
    { sequence: 1, status: "visited" as const },
    { sequence: 2, status: "skipped" as const },
    { sequence: 3, status: "pending" as const },
    { sequence: 4, status: "pending" as const },
  ];

  it("counts settled stops toward completion", () => {
    expect(routeProgress(stops)).toEqual({
      total: 4,
      visited: 1,
      skipped: 1,
      pending: 2,
      completionPct: 50,
    });
  });

  it("reports an empty route as zero rather than complete", () => {
    expect(routeProgress([]).completionPct).toBe(0);
  });

  it("points at the lowest pending sequence", () => {
    expect(nextStop(stops)?.sequence).toBe(3);
  });

  it("has no next stop once everything is settled", () => {
    expect(nextStop([{ sequence: 1, status: "visited" }])).toBeNull();
  });
});

describe("target comparison", () => {
  it("reports only metrics that have a stored target", () => {
    expect(
      compareTargets(
        [
          { metric: "order_value", targetValue: 200000 },
          { metric: "visits", targetValue: 40 },
        ],
        { order_value: 150000 }
      )
    ).toEqual([
      { metric: "order_value", target: 200000, achieved: 150000, achievementPct: 75 },
      { metric: "visits", target: 40, achieved: 0, achievementPct: 0 },
    ]);
  });

  it("ignores a zero target rather than dividing by it", () => {
    expect(compareTargets([{ metric: "visits", targetValue: 0 }], { visits: 3 })).toEqual([]);
  });
});
