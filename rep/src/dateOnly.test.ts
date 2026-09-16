import { describe, expect, it } from "vitest";

import { expenseDatePayload } from "./screens/expenseDate";
import { formatDateOnly, isDateWithinBounds, localDayKey, monthCells, normalizeDateRange, parseDateOnly } from "./dateOnly";

describe("Salesperson date-only controls", () => {
  it("rejects impossible dates and preserves valid dates at UTC noon", () => {
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("2026-02-28")).not.toBeNull();
    expect(expenseDatePayload("2026-09-15")).toBe("2026-09-15T12:00:00.000Z");
  });

  it("uses the local calendar day for a new field without mutating the selected day", () => {
    expect(localDayKey(new Date(2026, 8, 15))).toBe("2026-09-15");
    expect(formatDateOnly("2026-09-15")).toContain("15");
  });

  it("enforces inclusive date bounds and returns a complete month grid", () => {
    expect(isDateWithinBounds("2026-03-01", "2026-03-01", "2026-03-31")).toBe(true);
    expect(isDateWithinBounds("2026-04-01", undefined, "2026-03-31")).toBe(false);
    expect(monthCells(new Date(2026, 1, 1)).filter(Boolean)).toHaveLength(28);
  });

  it("keeps the leave end date on or after a newly selected start date", () => {
    expect(normalizeDateRange("2026-09-17", "2026-09-16")).toEqual({
      fromDate: "2026-09-17",
      toDate: "2026-09-17",
    });
    expect(normalizeDateRange("2026-09-16", "2026-09-17")).toEqual({
      fromDate: "2026-09-16",
      toDate: "2026-09-17",
    });
  });
});
