import { describe, expect, it } from "vitest";
import { comparableDay, greetingFor, periodForDay, startOfDay } from "../period";

describe("founder period", () => {
  it("uses the Asia/Kolkata calendar day, not UTC", () => {
    const lateEveningIst = new Date("2026-09-02T01:30:00.000Z"); // 07:00 IST
    const period = periodForDay(lateEveningIst);
    expect(period.start.toISOString()).toBe("2026-09-01T18:30:00.000Z");
    expect(comparableDay(period).start.toISOString()).toBe("2026-08-25T18:30:00.000Z");
    expect(startOfDay(lateEveningIst).toISOString()).toBe(period.start.toISOString());
  });

  it("greets from IST hour", () => {
    expect(greetingFor(new Date("2026-09-02T03:00:00.000Z"), "Ananya Shah")).toBe("Good morning, Ananya");
    expect(greetingFor(new Date("2026-09-02T10:00:00.000Z"), "Ananya Shah")).toBe("Good afternoon, Ananya");
  });
});
