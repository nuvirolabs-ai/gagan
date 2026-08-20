import { describe, expect, it } from "vitest";
import { addWorkingHours } from "../slaService";

const workingDates = new Set(["2026-08-21", "2026-08-24", "2026-08-25"]);
const lookup = async (date: string) => workingDates.has(date);

describe("approval SLA calendar", () => {
  it("adds four working hours across a weekend in India business time", async () => {
    // Friday 4pm IST -> one hour Friday + three hours Monday -> Monday noon IST.
    const start = new Date("2026-08-21T10:30:00.000Z");
    await expect(addWorkingHours(start, 4, lookup)).resolves.toEqual(
      new Date("2026-08-24T06:30:00.000Z")
    );
  });

  it("starts the clock at the next working-day opening when raised after hours", async () => {
    const start = new Date("2026-08-21T15:30:00.000Z"); // Friday 9pm IST
    await expect(addWorkingHours(start, 4, lookup)).resolves.toEqual(
      new Date("2026-08-24T07:30:00.000Z") // Monday 1pm IST
    );
  });

  it("cannot loop forever when no future working day is available", async () => {
    const missing = async () => false;
    await expect(addWorkingHours(new Date("2026-08-20T10:00:00.000Z"), 1, missing, 5))
      .rejects.toThrow("working_calendar_exhausted");
  });
});
