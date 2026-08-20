import { prisma } from "../../lib/prisma";

export type WorkingDayLookup = (date: string) => Promise<boolean>;

const INDIA_OFFSET_MINUTES = 330;
const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 17;

function localDateKey(local: Date) {
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

function atLocalHour(local: Date, hour: number) {
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour));
}

function nextLocalDay(local: Date) {
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, WORKDAY_START_HOUR));
}

export const databaseWorkingDay: WorkingDayLookup = async (date) => {
  const row = await prisma.workingCalendar.findUnique({
    where: { date: new Date(`${date}T00:00:00.000Z`) },
    select: { isWorkingDay: true },
  });
  if (row) return row.isWorkingDay;
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day !== 0 && day !== 6;
};

/** Adds India office hours (09:00-17:00 IST) over the versioned working calendar. */
export async function addWorkingHours(
  start: Date,
  hours: number,
  isWorkingDay: WorkingDayLookup = databaseWorkingDay,
  maxDaysScanned = 3660
): Promise<Date> {
  let remainingMs = hours * 60 * 60 * 1000;
  let local = new Date(start.getTime() + INDIA_OFFSET_MINUTES * 60_000);
  let daysScanned = 0;

  while (remainingMs > 0) {
    if (!(await isWorkingDay(localDateKey(local)))) {
      if (++daysScanned > maxDaysScanned) throw new Error("working_calendar_exhausted");
      local = nextLocalDay(local);
      continue;
    }
    const opening = atLocalHour(local, WORKDAY_START_HOUR);
    const closing = atLocalHour(local, WORKDAY_END_HOUR);
    if (local < opening) local = opening;
    if (local >= closing) {
      local = nextLocalDay(local);
      continue;
    }
    const available = closing.getTime() - local.getTime();
    const consumed = Math.min(available, remainingMs);
    local = new Date(local.getTime() + consumed);
    remainingMs -= consumed;
    if (remainingMs > 0) local = nextLocalDay(local);
  }

  return new Date(local.getTime() - INDIA_OFFSET_MINUTES * 60_000);
}
