export const FOUNDER_TIME_ZONE = "Asia/Kolkata";

export interface CalendarPeriod {
  start: Date;
  end: Date;
  timeZone: string;
  label: string;
}

export function calendarDateInZone(now: Date, timeZone = FOUNDER_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Prisma `@db.Date` key for the IST calendar day (UTC midnight of that Y-M-D). */
export function dateColumn(now: Date, timeZone = FOUNDER_TIME_ZONE): Date {
  return new Date(`${calendarDateInZone(now, timeZone)}T00:00:00.000Z`);
}

/** Midnight IST for the calendar day that contains `now`. */
export function startOfDay(now: Date, timeZone = FOUNDER_TIME_ZONE): Date {
  return new Date(`${calendarDateInZone(now, timeZone)}T00:00:00+05:30`);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function periodForDay(now: Date, timeZone = FOUNDER_TIME_ZONE): CalendarPeriod {
  const start = startOfDay(now, timeZone);
  const end = addDays(start, 1);
  const label = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  return { start, end, timeZone, label };
}

/** Same weekday one week earlier. */
export function comparableDay(period: CalendarPeriod): CalendarPeriod {
  const start = addDays(period.start, -7);
  return {
    start,
    end: addDays(start, 1),
    timeZone: period.timeZone,
    label: period.label,
  };
}

export function greetingFor(now: Date, name: string, timeZone = FOUNDER_TIME_ZONE): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hour12: false }).format(now)
  );
  const first = name.trim().split(/\s+/)[0] || "there";
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}
