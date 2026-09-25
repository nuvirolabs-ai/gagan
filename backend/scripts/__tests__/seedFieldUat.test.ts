import { describe, expect, it } from "vitest";
import { isDayInProgress, parseUatDate, stopsMatch } from "../seedFieldUat";

/**
 * The fixture's whole value is that it can be run repeatedly, including on a
 * day that is already underway. These three functions are where that promise
 * would break silently, so they are tested away from the database.
 */

describe("choosing the UAT date", () => {
  it("defaults to today at UTC midnight", () => {
    const now = new Date("2026-09-01T17:45:12.000Z");
    expect(parseUatDate([], now).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("strips the time so two runs on one day hit the same row", () => {
    // planDate is a DATE column and is uniquely keyed with the salesperson. A
    // stray time component would create a second plan for the same day.
    const morning = parseUatDate([], new Date("2026-09-01T06:00:00.000Z"));
    const evening = parseUatDate([], new Date("2026-09-01T23:59:59.000Z"));
    expect(morning.getTime()).toBe(evening.getTime());
  });

  it("takes an explicit date so tomorrow's day can be prepared tonight", () => {
    expect(parseUatDate(["--date=2026-09-02"]).toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });

  it("ignores unrelated arguments", () => {
    expect(parseUatDate(["node", "script.ts", "--date=2026-12-25"]).toISOString()).toBe(
      "2026-12-25T00:00:00.000Z"
    );
  });

  it("refuses a malformed date rather than silently using today", () => {
    expect(() => parseUatDate(["--date=tomorrow"])).toThrow(/YYYY-MM-DD/);
    expect(() => parseUatDate(["--date=01-09-2026"])).toThrow(/YYYY-MM-DD/);
    expect(() => parseUatDate(["--date="])).toThrow(/YYYY-MM-DD/);
  });

  it("refuses a well-formed date that does not exist", () => {
    expect(() => parseUatDate(["--date=2026-02-30"])).toThrow();
  });
});

describe("deciding whether the route already matches", () => {
  const intended = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("matches the same stores in the same order", () => {
    expect(
      stopsMatch(
        [
          { retailerId: "a", sequence: 1 },
          { retailerId: "b", sequence: 2 },
          { retailerId: "c", sequence: 3 },
        ],
        intended
      )
    ).toBe(true);
  });

  it("reads sequence rather than array position", () => {
    expect(
      stopsMatch(
        [
          { retailerId: "c", sequence: 3 },
          { retailerId: "a", sequence: 1 },
          { retailerId: "b", sequence: 2 },
        ],
        intended
      )
    ).toBe(true);
  });

  it("does not match the same stores in a different order", () => {
    // A beat is a sequence; reordering it is a different day's work.
    expect(
      stopsMatch(
        [
          { retailerId: "b", sequence: 1 },
          { retailerId: "a", sequence: 2 },
          { retailerId: "c", sequence: 3 },
        ],
        intended
      )
    ).toBe(false);
  });

  it("does not match a different number of stops", () => {
    expect(stopsMatch([{ retailerId: "a", sequence: 1 }], intended)).toBe(false);
  });

  it("treats an empty route as not matching", () => {
    expect(stopsMatch([], intended)).toBe(false);
  });
});

describe("detecting a day already underway", () => {
  it("is false while every stop is pending", () => {
    expect(isDayInProgress([{ status: "pending" }, { status: "pending" }])).toBe(false);
  });

  it("is false for a plan with no stops yet", () => {
    expect(isDayInProgress([])).toBe(false);
  });

  it("is true once a stop has been visited", () => {
    // The guard exists so re-running mid-session cannot delete a stop that a
    // SalesVisit already points at.
    expect(isDayInProgress([{ status: "visited" }, { status: "pending" }])).toBe(true);
  });

  it("is true once a stop has been skipped", () => {
    expect(isDayInProgress([{ status: "pending" }, { status: "skipped" }])).toBe(true);
  });
});
