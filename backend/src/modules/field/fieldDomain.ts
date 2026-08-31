/**
 * Pure rules for the salesperson's field day.
 *
 * Nothing in this file touches the database or the network, so the day-state,
 * tracking and productivity rules can be asserted directly. Services in this
 * module own persistence; this file owns the decisions.
 */

export type AttendanceMark = "present" | "leave" | "absent" | "holiday" | "not_due";

export interface AttendanceDayInput {
  /** The calendar day being marked. */
  date: Date;
  /** A WorkdaySession exists for the salesperson on this day. */
  hasWorkday: boolean;
  /** An approved LeaveRequest covers this day. */
  onApprovedLeave: boolean;
  /** WorkingCalendar says this is a working day. Unknown days count as working. */
  isWorkingDay: boolean;
  /** "Today" in the deployment's timezone, so future days are not marked absent. */
  today: Date;
}

/**
 * Attendance is derived, never stored as a status column: a day is `present`
 * because a workday session exists, `leave` because a leave request was
 * approved, and `absent` only once the day is over and neither happened.
 */
export function resolveAttendanceMark(input: AttendanceDayInput): AttendanceMark {
  if (input.hasWorkday) return "present";
  if (input.onApprovedLeave) return "leave";
  if (!input.isWorkingDay) return "holiday";
  if (startOfDay(input.date).getTime() > startOfDay(input.today).getTime()) return "not_due";
  return "absent";
}

/** Whole minutes between clock-in and clock-out; never negative. */
export function workedMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 60_000));
}

/** UTC midnight of the given instant — the canonical `@db.Date` value. */
export function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function endOfDay(value: Date): Date {
  const start = startOfDay(value);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let cursor = startOfDay(from); cursor <= startOfDay(to); cursor = new Date(cursor.getTime() + 86_400_000)) {
    days.push(cursor);
  }
  return days;
}

/** Inclusive day-range overlap, used to match leave requests to a date. */
export function dateWithinRange(date: Date, from: Date, to: Date): boolean {
  const day = startOfDay(date).getTime();
  return day >= startOfDay(from).getTime() && day <= startOfDay(to).getTime();
}

/* --------------------------- movement tracking --------------------------- */

export type TrackingReason =
  | "tracking_active"
  | "policy_disabled"
  | "off_duty"
  | "permission_required";

export interface TrackingStateInput {
  /** AppConfig.locationTrackingEnabled — the tenant-level policy switch. */
  policyEnabled: boolean;
  /** A workday session is open right now. */
  workdayOpen: boolean;
  /** The device has granted location permission. */
  permissionGranted: boolean;
}

export interface TrackingState {
  tracking: boolean;
  reason: TrackingReason;
}

/**
 * Movement is only recorded while the salesperson is on duty. Clocking out is
 * what stops tracking, and the app shows this state to the salesperson so the
 * behaviour is never hidden from the person being tracked.
 */
export function resolveTrackingState(input: TrackingStateInput): TrackingState {
  if (!input.policyEnabled) return { tracking: false, reason: "policy_disabled" };
  if (!input.workdayOpen) return { tracking: false, reason: "off_duty" };
  if (!input.permissionGranted) return { tracking: false, reason: "permission_required" };
  return { tracking: true, reason: "tracking_active" };
}

export const TRACKING_REASON_COPY: Record<TrackingReason, string> = {
  tracking_active: "Your location is being recorded while your day is running.",
  policy_disabled: "Location recording is switched off for your organisation.",
  off_duty: "Your location is not recorded. Start your day to share your route.",
  permission_required: "Allow location access to share your route while your day is running.",
};

export interface SamplingInput {
  now: Date;
  lastRecordedAt: Date | null;
  intervalSeconds: number;
  /** Metres moved since the last recorded ping, when known. */
  movedMeters?: number | null;
  accuracyMeters: number;
  maxAccuracyMeters: number;
}

/**
 * Battery-conscious sampling: keep one ping per interval, drop readings the
 * device itself calls unreliable, and drop readings that show no real movement
 * so a stationary phone does not fill the table.
 */
export function shouldRecordPing(input: SamplingInput): boolean {
  if (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters <= 0) return false;
  if (input.accuracyMeters > input.maxAccuracyMeters) return false;
  if (!input.lastRecordedAt) return true;
  const elapsedSeconds = (input.now.getTime() - input.lastRecordedAt.getTime()) / 1000;
  if (elapsedSeconds < input.intervalSeconds) return false;
  if (input.movedMeters != null && input.movedMeters < STATIONARY_METERS) return false;
  return true;
}

/** Below this, consecutive readings are GPS jitter rather than movement. */
export const STATIONARY_METERS = 25;

/* ------------------------------- activities ------------------------------- */

export const CUSTOMER_ACTIVITY_TYPES = [
  "order_discussion",
  "order_placed",
  "payment_discussion",
  "collection_completed",
  "product_demo",
  "stock_check",
  "merchandising",
  "complaint_raised",
  "follow_up_required",
  "competitor_observation",
  "no_order",
  "shop_closed",
  "decision_maker_unavailable",
  "note",
] as const;

export type CustomerActivityTypeName = (typeof CUSTOMER_ACTIVITY_TYPES)[number];

export const CUSTOMER_ACTIVITY_LABELS: Record<CustomerActivityTypeName, string> = {
  order_discussion: "Order discussion",
  order_placed: "Order placed",
  payment_discussion: "Payment discussion",
  collection_completed: "Collection completed",
  product_demo: "Product demonstration",
  stock_check: "Stock check",
  merchandising: "Merchandising",
  complaint_raised: "Complaint / service issue",
  follow_up_required: "Follow-up required",
  competitor_observation: "Competitor observation",
  no_order: "No order",
  shop_closed: "Shop closed",
  decision_maker_unavailable: "Decision maker unavailable",
  note: "Note",
};

/** Activity types that, on their own, make a visit commercially productive. */
const PRODUCTIVE_ACTIVITY_TYPES: CustomerActivityTypeName[] = [
  "order_placed",
  "collection_completed",
];

export const VISIT_OUTCOMES = [
  "order_placed",
  "no_order",
  "payment_collected",
  "follow_up_required",
  "issue_raised",
  "shop_closed",
  "decision_maker_unavailable",
  "other",
] as const;

export type VisitOutcomeName = (typeof VISIT_OUTCOMES)[number];

export const VISIT_OUTCOME_LABELS: Record<VisitOutcomeName, string> = {
  order_placed: "Order placed",
  no_order: "No order",
  payment_collected: "Payment collected",
  follow_up_required: "Follow-up required",
  issue_raised: "Issue raised",
  shop_closed: "Shop closed",
  decision_maker_unavailable: "Decision maker unavailable",
  other: "Other",
};

const PRODUCTIVE_OUTCOMES: VisitOutcomeName[] = ["order_placed", "payment_collected"];

/**
 * A visit counts as productive when it produced an order or a payment — either
 * declared as the visit outcome, or logged as an activity inside it.
 */
export function isProductiveVisit(input: {
  outcome?: string | null;
  activityTypes?: readonly string[];
}): boolean {
  if (input.outcome && (PRODUCTIVE_OUTCOMES as string[]).includes(input.outcome)) return true;
  return (input.activityTypes ?? []).some((type) =>
    (PRODUCTIVE_ACTIVITY_TYPES as string[]).includes(type)
  );
}

/* --------------------------------- routes -------------------------------- */

export interface RouteStopProgress {
  status: "pending" | "visited" | "skipped";
  sequence: number;
}

export interface RouteProgress {
  total: number;
  visited: number;
  skipped: number;
  pending: number;
  completionPct: number;
}

export function routeProgress(stops: readonly RouteStopProgress[]): RouteProgress {
  const total = stops.length;
  const visited = stops.filter((stop) => stop.status === "visited").length;
  const skipped = stops.filter((stop) => stop.status === "skipped").length;
  const pending = total - visited - skipped;
  return {
    total,
    visited,
    skipped,
    pending,
    // Skipped stops are settled, not outstanding: a route with every stop
    // either visited or explicitly skipped is finished.
    completionPct: total === 0 ? 0 : Math.round(((visited + skipped) / total) * 100),
  };
}

/** The stop the salesperson should head to next: lowest pending sequence. */
export function nextStop<T extends RouteStopProgress>(stops: readonly T[]): T | null {
  return (
    [...stops]
      .filter((stop) => stop.status === "pending")
      .sort((a, b) => a.sequence - b.sequence)[0] ?? null
  );
}

/* ------------------------------- performance ------------------------------ */

export interface TargetComparison {
  metric: string;
  target: number;
  achieved: number;
  achievementPct: number;
}

/**
 * Target-versus-achievement is only ever produced from a stored target row.
 * A metric with no target is omitted rather than defaulted to zero, so the
 * dashboard cannot imply a goal nobody set.
 */
export function compareTargets(
  targets: readonly { metric: string; targetValue: number }[],
  achievements: Readonly<Record<string, number>>
): TargetComparison[] {
  return targets
    .filter((target) => target.targetValue > 0)
    .map((target) => {
      const achieved = achievements[target.metric] ?? 0;
      return {
        metric: target.metric,
        target: target.targetValue,
        achieved,
        achievementPct: Math.round((achieved / target.targetValue) * 100),
      };
    });
}
