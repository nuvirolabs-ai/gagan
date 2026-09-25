import { describe, expect, it } from "vitest";
import { addDays, monthGrid, parseIsoDay } from "../dateHelpers";

describe("field date helpers", () => {
  it("accepts real ISO calendar dates and rejects impossible ones", () => {
    expect(parseIsoDay("2026-03-10")?.toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(parseIsoDay("2026-02-30")).toBeNull();
  });

  it("moves follow-up dates without local timezone drift", () => {
    expect(addDays("2026-03-10", 1)).toBe("2026-03-11");
    expect(addDays("2026-03-10", 7)).toBe("2026-03-17");
  });

  it("creates a Sunday-first month grid", () => {
    const grid = monthGrid(new Date("2026-03-01T00:00:00.000Z"));
    expect(grid[0]).toBe("2026-03-01");
    expect(grid).toContain("2026-03-31");
  });
});
