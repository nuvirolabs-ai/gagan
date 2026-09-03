export const FIELD_DAILY_TARGET = 64_000;
export const FIELD_WEEKLY_TARGET = 325_000;
export const MILESTONES = [25, 50, 75, 80] as const;

export type RouteStopStatus = "NEXT" | "DONE" | "PLANNED";

export type SalesHomeRetailer = {
  id: string;
  name: string;
  shopAddress: string;
  beatName?: string | null;
  district?: string | null;
};

export type SalesHomeVisit = {
  id: string;
  retailerId: string;
  checkedOutAt: Date | string | null;
  retailerName?: string | null;
};

export type SalesHomeInput = {
  staff: { id: string; name: string };
  territory?: string | null;
  retailers: SalesHomeRetailer[];
  visitsToday: SalesHomeVisit[];
  todaySales: number;
  weekSales: number;
  pendingApprovals?: number;
  now?: Date;
};

export type SalesHomePayload = ReturnType<typeof buildSalesHome>;

const SLOT_MINUTES = [9 * 60 + 30, 11 * 60, 12 * 60 + 30, 14 * 60, 15 * 60 + 30, 17 * 60];

export function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function startOfUtcWeek(now: Date) {
  const start = startOfUtcDay(now);
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  return start;
}

export function percentOfTarget(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

export function greetingPeriod(now: Date) {
  const hour = now.getUTCHours();
  if (hour < 12) return "morning" as const;
  if (hour < 17) return "afternoon" as const;
  return "evening" as const;
}

function formatSlot(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function areaFor(retailer: SalesHomeRetailer) {
  return retailer.beatName?.trim() || retailer.district?.trim() || retailer.shopAddress;
}

export function buildSalesHome(input: SalesHomeInput) {
  const now = input.now ?? new Date();
  const doneIds = new Set(input.visitsToday.map((visit) => visit.retailerId));
  const stops = input.retailers.map((retailer, index) => {
    const done = doneIds.has(retailer.id);
    return {
      id: retailer.id,
      name: retailer.name,
      address: retailer.shopAddress,
      area: areaFor(retailer),
      timeLabel: formatSlot(SLOT_MINUTES[index] ?? 9 * 60 + 30 + index * 90),
      status: (done ? "DONE" : "PLANNED") as RouteStopStatus,
    };
  });
  const next = stops.find((stop) => stop.status !== "DONE") ?? null;
  if (next) next.status = "NEXT";

  const planned = stops.length;
  const done = stops.filter((stop) => stop.status === "DONE").length;
  const remaining = Math.max(planned - done, 0);
  const dailyPct = percentOfTarget(input.todaySales, FIELD_DAILY_TARGET);
  const weeklyPct = percentOfTarget(input.weekSales, FIELD_WEEKLY_TARGET);
  const hitMilestones = MILESTONES.filter((mark) => dailyPct >= mark);
  const currentMilestone = hitMilestones[hitMilestones.length - 1] ?? null;
  const nextMilestone = MILESTONES.find((mark) => dailyPct < mark) ?? null;
  const activeVisit = input.visitsToday.find((visit) => !visit.checkedOutAt) ?? null;

  return {
    staff: input.staff,
    territory: input.territory ?? null,
    greeting: greetingPeriod(now),
    sales: {
      today: input.todaySales,
      week: input.weekSales,
      dailyTarget: FIELD_DAILY_TARGET,
      weeklyTarget: FIELD_WEEKLY_TARGET,
      dailyPct,
      weeklyPct,
      milestones: [...MILESTONES],
      hitMilestones,
      currentMilestone,
      nextMilestone,
    },
    route: {
      planned,
      done,
      remaining,
      coveragePct: planned === 0 ? 0 : Math.round((done / planned) * 100),
      onTrack: remaining === 0 || done > 0 || planned <= 3,
      stops,
      next,
    },
    attendance: {
      punchedIn: input.visitsToday.length > 0,
      activeVisit: activeVisit
        ? {
            id: activeVisit.id,
            retailerId: activeVisit.retailerId,
            retailerName: activeVisit.retailerName ?? next?.name ?? null,
          }
        : null,
    },
    badges: { notifications: input.pendingApprovals ?? 0 },
  };
}
