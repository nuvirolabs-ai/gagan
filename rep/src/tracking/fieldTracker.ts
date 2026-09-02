/**
 * Client-side movement sampling.
 *
 * The server decides whether tracking is allowed at all (policy + an open
 * workday); this decides how often the device bothers to take a reading, and
 * drops readings that would tell nobody anything. Every accepted reading goes
 * into the offline outbox, so a dead zone costs the salesperson nothing.
 *
 * Scope: this samples while the app is in the foreground with a workday open.
 * Background sampling needs a native background-location task and the store
 * declarations that go with it; the ingest contract and the outbox are already
 * shaped for it, and the tracking banner tells the salesperson exactly what is
 * being recorded either way.
 */

export interface TrackerReading {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  recordedAt: number;
  speedMps?: number | null;
  headingDegrees?: number | null;
}

export interface SamplingPolicy {
  intervalSeconds: number;
  maxAccuracyMeters: number;
  /** Below this, two readings are GPS jitter rather than movement. */
  stationaryMeters: number;
}

export const DEFAULT_SAMPLING: SamplingPolicy = {
  intervalSeconds: 300,
  maxAccuracyMeters: 100,
  stationaryMeters: 25,
};

const EARTH_RADIUS_METERS = 6_371_000;

export function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export type SampleDecision =
  | { record: true }
  | { record: false; reason: "too_soon" | "inaccurate" | "stationary" };

/**
 * Mirrors the server's own sampling rule so the device does not spend battery
 * and bandwidth sending readings the server would discard.
 */
export function decideSample(input: {
  reading: TrackerReading;
  last: TrackerReading | null;
  policy: SamplingPolicy;
}): SampleDecision {
  const { reading, last, policy } = input;
  if (!Number.isFinite(reading.accuracyMeters) || reading.accuracyMeters <= 0) {
    return { record: false, reason: "inaccurate" };
  }
  if (reading.accuracyMeters > policy.maxAccuracyMeters) {
    return { record: false, reason: "inaccurate" };
  }
  if (!last) return { record: true };
  const elapsedSeconds = (reading.recordedAt - last.recordedAt) / 1000;
  if (elapsedSeconds < policy.intervalSeconds) return { record: false, reason: "too_soon" };
  if (metersBetween(last, reading) < policy.stationaryMeters) {
    return { record: false, reason: "stationary" };
  }
  return { record: true };
}

export interface TrackingBanner {
  tone: "active" | "idle" | "attention";
  title: string;
  body: string;
}

/**
 * The copy the salesperson sees. Tracking is never silent: whichever state the
 * day is in, the app says so on the Today screen in plain words.
 */
export function trackingBanner(state: {
  tracking: boolean;
  reason: string;
  pendingUploads?: number;
}): TrackingBanner {
  const queued =
    state.pendingUploads && state.pendingUploads > 0
      ? ` ${state.pendingUploads} reading${state.pendingUploads === 1 ? "" : "s"} waiting to sync.`
      : "";
  switch (state.reason) {
    case "tracking_active":
      return {
        tone: "active",
        title: "Location sharing on",
        body: `Used to verify routes and store visits. Recording stops when you end your day.${queued}`,
      };
    case "policy_disabled":
      return {
        tone: "idle",
        title: "Location sharing off",
        body: "Your organisation has turned off route recording. Nothing is being recorded.",
      };
    case "permission_required":
      return {
        tone: "attention",
        title: "Location permission needed",
        body: "Allow location access so your route can be shared while your day is running.",
      };
    default:
      return {
        tone: "idle",
        title: "Location sharing off",
        body: `Location is only recorded while you're on duty.${queued}`,
      };
  }
}
