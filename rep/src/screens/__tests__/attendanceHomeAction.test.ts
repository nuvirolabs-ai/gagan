import { describe, expect, it } from "vitest";

import { homeAttendanceAction } from "../attendanceHomeAction";

describe("Home Attendance shortcut", () => {
  it("opens attendance history after the day is complete", () => {
    expect(homeAttendanceAction({ dayOpen: false, dayClosed: true })).toBe("open_attendance");
  });

  it("keeps the existing end-day flow while on duty", () => {
    expect(homeAttendanceAction({ dayOpen: true, dayClosed: false })).toBe("end_day");
  });

  it("keeps the existing guarded start-day flow before attendance starts", () => {
    expect(homeAttendanceAction({ dayOpen: false, dayClosed: false })).toBe("start_day");
  });
});
