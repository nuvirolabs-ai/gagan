import { describe, expect, it } from "vitest";
import { nextQuarterlyCheckpoint } from "../reviewSchedule";

describe("fixed quarterly review schedule", () => {
  it.each([
    ["2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z"],
    ["2026-02-15T12:00:00.000Z", "2026-04-01T00:00:00.000Z"],
    ["2026-08-20T10:00:00.000Z", "2026-10-01T00:00:00.000Z"],
    ["2026-12-31T23:59:59.000Z", "2027-01-01T00:00:00.000Z"],
  ])("moves %s to %s", (after, expected) => {
    expect(nextQuarterlyCheckpoint(new Date(after))).toEqual(new Date(expected));
  });
});
