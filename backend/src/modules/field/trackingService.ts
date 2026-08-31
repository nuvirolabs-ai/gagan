import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { validateCoordinateInput } from "../location/locationDomain";
import { FieldServiceError } from "./attendanceService";
import { resolveTrackingState, startOfDay, TRACKING_REASON_COPY } from "./fieldDomain";

type Db = PrismaClient | any;

export interface PingInput {
  clientReference: string;
  recordedAt: Date;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedMps?: number | null;
  headingDegrees?: number | null;
  batteryPct?: number | null;
}

export interface IngestResult {
  accepted: number;
  duplicates: number;
  rejected: Array<{ clientReference: string; reason: string }>;
}

/**
 * Movement tracking during working hours.
 *
 * Privacy model, enforced here rather than in the client:
 *  - a ping is only stored against an *open* workday session, so nothing is
 *    recorded before clock-in or after clock-out;
 *  - a ping timestamped outside its session's window is rejected, so a stale
 *    offline buffer cannot backfill off-duty movement;
 *  - the whole feature can be switched off for the tenant, and the app shows
 *    the salesperson which state they are in.
 */
export class TrackingService {
  constructor(private readonly prisma: Db = defaultPrisma) {}

  private async config() {
    const config = await this.prisma.appConfig.findUnique({ where: { id: "singleton" } });
    return {
      trackingEnabled: config?.locationTrackingEnabled ?? true,
      pingIntervalSeconds: config?.locationPingIntervalSeconds ?? 300,
    };
  }

  async state(input: { salespersonId: string; permissionGranted?: boolean }) {
    const [{ trackingEnabled, pingIntervalSeconds }, session] = await Promise.all([
      this.config(),
      this.prisma.workdaySession.findFirst({
        where: { salespersonId: input.salespersonId, status: "open" },
        orderBy: { startedAt: "desc" },
      }),
    ]);
    const state = resolveTrackingState({
      policyEnabled: trackingEnabled,
      workdayOpen: session != null,
      // The device is the only thing that knows the permission answer; when it
      // does not say, assume granted so the state reflects server policy only.
      permissionGranted: input.permissionGranted ?? true,
    });
    return {
      ...state,
      message: TRACKING_REASON_COPY[state.reason],
      pingIntervalSeconds,
      workdaySessionId: session?.id ?? null,
      workdayStartedAt: session?.startedAt ?? null,
    };
  }

  /**
   * Batch ingest. Each ping carries a device-generated reference, so a retried
   * batch is counted as a duplicate instead of being written twice.
   */
  async ingest(input: { salespersonId: string; pings: PingInput[] }): Promise<IngestResult> {
    const { trackingEnabled } = await this.config();
    if (!trackingEnabled) throw new FieldServiceError("location_tracking_disabled", 409);
    if (input.pings.length === 0) return { accepted: 0, duplicates: 0, rejected: [] };
    if (input.pings.length > MAX_BATCH_SIZE) throw new FieldServiceError("ping_batch_too_large", 413);

    const session = await this.prisma.workdaySession.findFirst({
      where: { salespersonId: input.salespersonId, status: "open" },
      orderBy: { startedAt: "desc" },
    });
    if (!session) throw new FieldServiceError("workday_not_open", 409);

    const result: IngestResult = { accepted: 0, duplicates: 0, rejected: [] };
    const now = new Date();
    const accepted: PingInput[] = [];

    for (const ping of input.pings) {
      try {
        validateCoordinateInput(ping);
      } catch {
        result.rejected.push({ clientReference: ping.clientReference, reason: "invalid_coordinates" });
        continue;
      }
      if (ping.recordedAt < session.startedAt) {
        result.rejected.push({ clientReference: ping.clientReference, reason: "before_workday_start" });
        continue;
      }
      if (ping.recordedAt > now) {
        result.rejected.push({ clientReference: ping.clientReference, reason: "recorded_in_future" });
        continue;
      }
      accepted.push(ping);
    }

    if (accepted.length === 0) return result;

    // A whole buffered day arrives as one insert. `skipDuplicates` makes the
    // replay of an already-delivered batch cost nothing, and the difference
    // between what was offered and what was written is the duplicate count.
    const written = await this.prisma.locationPing.createMany({
      data: accepted.map((ping) => ({
        workdaySessionId: session.id,
        salespersonId: input.salespersonId,
        recordedAt: ping.recordedAt,
        latitude: ping.latitude,
        longitude: ping.longitude,
        accuracyMeters: ping.accuracyMeters,
        speedMps: ping.speedMps ?? null,
        headingDegrees: ping.headingDegrees ?? null,
        batteryPct: ping.batteryPct ?? null,
        clientReference: ping.clientReference,
      })),
      skipDuplicates: true,
    });

    result.accepted = written.count;
    result.duplicates = accepted.length - written.count;
    return result;
  }

  /** Movement history for one salesperson and date, for authorised reviewers. */
  async history(input: { salespersonId: string; date: Date }) {
    const workDate = startOfDay(input.date);
    const session = await this.prisma.workdaySession.findUnique({
      where: { salespersonId_workDate: { salespersonId: input.salespersonId, workDate } },
    });
    if (!session) return { session: null, pings: [] };
    const pings = await this.prisma.locationPing.findMany({
      where: { workdaySessionId: session.id },
      orderBy: { recordedAt: "asc" },
      take: 1000,
    });
    return { session, pings };
  }

  /** The last position recorded for each salesperson who is on duty now. */
  async lastKnownPositions() {
    const sessions = await this.prisma.workdaySession.findMany({
      where: { status: "open" },
      include: {
        salesperson: { select: { id: true, name: true, salesRep: { select: { territory: true } } } },
        locationPings: { orderBy: { recordedAt: "desc" }, take: 1 },
      },
    });
    return sessions.map((session: any) => ({
      salespersonId: session.salespersonId,
      name: session.salesperson.name,
      territory: session.salesperson.salesRep?.territory ?? null,
      startedAt: session.startedAt,
      lastPing: session.locationPings[0]
        ? {
            recordedAt: session.locationPings[0].recordedAt,
            latitude: Number(session.locationPings[0].latitude),
            longitude: Number(session.locationPings[0].longitude),
            accuracyMeters: Number(session.locationPings[0].accuracyMeters),
          }
        : null,
    }));
  }
}

/** One sync of a buffered day should never need more than this. */
export const MAX_BATCH_SIZE = 200;

export const defaultTrackingService = new TrackingService();
