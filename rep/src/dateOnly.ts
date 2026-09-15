/** Date-only helpers shared by editable date controls and their API adapters. */
export function localDayKey(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD value at UTC noon so device timezone cannot move the day. */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? parsed
    : null;
}

export function isDateWithinBounds(value: string, minDate?: string, maxDate?: string): boolean {
  if (!parseDateOnly(value)) return false;
  if (minDate && (!parseDateOnly(minDate) || value < minDate)) return false;
  if (maxDate && (!parseDateOnly(maxDate) || value > maxDate)) return false;
  return true;
}

export function formatDateOnly(value: string): string {
  const parsed = parseDateOnly(value);
  return parsed
    ? parsed.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : value;
}

export function monthLabel(cursor: Date): string {
  return cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** Returns a Sunday-first month grid, with nulls for leading/trailing cells. */
export function monthCells(cursor: Date): Array<string | null> {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((leading + count) / 7) * 7;
  return Array.from({ length: total }, (_, index) => {
    const day = index - leading + 1;
    return day < 1 || day > count ? null : `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

/** Explicit seven-cell rows avoid percentage rounding wrapping a day to the next week. */
export function calendarWeeks(cells: Array<string | null>): Array<Array<string | null>> {
  return Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) =>
    Array.from({ length: 7 }, (_, column) => cells[index * 7 + column] ?? null));
}
