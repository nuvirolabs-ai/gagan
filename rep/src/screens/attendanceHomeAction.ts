export type HomeAttendanceAction = "start_day" | "end_day" | "open_attendance";

/**
 * Keeps the Home shortcut aligned with the canonical attendance state machine.
 * A closed day is historical data, not permission to issue another start call.
 */
export function homeAttendanceAction(input: {
  dayOpen: boolean;
  dayClosed: boolean;
}): HomeAttendanceAction {
  if (input.dayClosed) return "open_attendance";
  if (input.dayOpen) return "end_day";
  return "start_day";
}
