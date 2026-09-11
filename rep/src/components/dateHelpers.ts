export function parseIsoDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

export function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDay(value) ?? new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}

export function monthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

export function shiftMonth(value: Date, offset: number): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1));
}

export function monthDays(value: Date): string[] {
  const start = monthStart(value);
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => isoDay(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), index + 1))));
}

/** Sunday-first calendar cells. Empty cells are represented by null. */
export function monthGrid(value: Date): Array<string | null> {
  const start = monthStart(value);
  const leading = start.getUTCDay();
  return [...Array.from({ length: leading }, () => null), ...monthDays(value)];
}

export function formatIsoDay(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  const date = parseIsoDay(value);
  return date ? date.toLocaleDateString("en-IN", { ...options, timeZone: "UTC" }) : value;
}
