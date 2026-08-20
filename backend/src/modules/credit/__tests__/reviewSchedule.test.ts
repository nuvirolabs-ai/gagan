import { describe, expect, it } from "vitest";
import { nextQuarterlyCheckpoint, shouldAdvanceMissedCheckpoint } from "../reviewSchedule";

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

describe("missed checkpoint advancement", () => {
  it("advances an unchanged letter rating because no confirmation will be queued", () => {
    expect(shouldAdvanceMissedCheckpoint({
      nextReviewAt: new Date("2026-07-01T00:00:00.000Z"),
      now: new Date("2026-08-20T10:00:00.000Z"),
      requiresConfirmation: true,
      currentRating: "B",
      proposedRating: "B",
    })).toBe(true);
  });

  it("keeps the checkpoint open when an actual rating change needs confirmation", () => {
    expect(shouldAdvanceMissedCheckpoint({
      nextReviewAt: new Date("2026-07-01T00:00:00.000Z"),
      now: new Date("2026-08-20T10:00:00.000Z"),
      requiresConfirmation: true,
      currentRating: "B",
      proposedRating: "A",
    })).toBe(false);
  });
});
