import { describe, expect, it } from "vitest";
import { TrackingService } from "../trackingService";
import { fakePrisma } from "./fakePrisma";

const ping = (overrides: Record<string, unknown> = {}) => ({
  clientReference: "ping-00000001",
  recordedAt: new Date("2026-03-10T10:00:00Z"),
  latitude: 18.52,
  longitude: 73.85,
  accuracyMeters: 15,
  ...overrides,
});

function openSession() {
  return {
    id: "session-1",
    salespersonId: "staff-1",
    status: "open",
    startedAt: new Date("2026-03-10T09:00:00Z"),
  };
}

describe("tracking state", () => {
  it("is off duty when no workday is open", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });
    prisma.workdaySession.findFirst.mockResolvedValue(null);

    const state = await new TrackingService(prisma).state({ salespersonId: "staff-1" });
    expect(state.tracking).toBe(false);
    expect(state.reason).toBe("off_duty");
    expect(state.message).toMatch(/not recorded/i);
  });

  it("reports the tenant policy switch", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: false });
    prisma.workdaySession.findFirst.mockResolvedValue(openSession());

    const state = await new TrackingService(prisma).state({ salespersonId: "staff-1" });
    expect(state).toMatchObject({ tracking: false, reason: "policy_disabled" });
  });

  it("hands the app the sampling interval to use", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({
      locationTrackingEnabled: true,
      locationPingIntervalSeconds: 180,
    });
    prisma.workdaySession.findFirst.mockResolvedValue(openSession());

    const state = await new TrackingService(prisma).state({ salespersonId: "staff-1" });
    expect(state).toMatchObject({
      tracking: true,
      pingIntervalSeconds: 180,
      workdaySessionId: "session-1",
    });
  });
});

describe("ping ingest", () => {
  it("refuses every ping when no workday is open", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });
    prisma.workdaySession.findFirst.mockResolvedValue(null);

    await expect(
      new TrackingService(prisma).ingest({ salespersonId: "staff-1", pings: [ping()] })
    ).rejects.toMatchObject({ code: "workday_not_open" });
    expect(prisma.locationPing.createMany).not.toHaveBeenCalled();
  });

  it("refuses every ping when tracking is switched off for the tenant", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: false });

    await expect(
      new TrackingService(prisma).ingest({ salespersonId: "staff-1", pings: [ping()] })
    ).rejects.toMatchObject({ code: "location_tracking_disabled" });
  });

  it("rejects a buffered ping timestamped before the day started", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });
    prisma.workdaySession.findFirst.mockResolvedValue(openSession());

    const result = await new TrackingService(prisma).ingest({
      salespersonId: "staff-1",
      pings: [ping({ recordedAt: new Date("2026-03-10T07:30:00Z") })],
    });

    expect(result.accepted).toBe(0);
    expect(result.rejected).toEqual([
      { clientReference: "ping-00000001", reason: "before_workday_start" },
    ]);
    expect(prisma.locationPing.createMany).not.toHaveBeenCalled();
  });

  it("rejects a ping stamped in the future", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });
    prisma.workdaySession.findFirst.mockResolvedValue(openSession());

    const result = await new TrackingService(prisma).ingest({
      salespersonId: "staff-1",
      pings: [ping({ recordedAt: new Date(Date.now() + 60 * 60_000) })],
    });
    expect(result.rejected[0].reason).toBe("recorded_in_future");
  });

  it("rejects an unusable coordinate without failing the whole batch", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });
    prisma.workdaySession.findFirst.mockResolvedValue(openSession());
    prisma.locationPing.createMany.mockResolvedValue({ count: 1 });

    const result = await new TrackingService(prisma).ingest({
      salespersonId: "staff-1",
      pings: [
        ping({ clientReference: "ping-bad-0001", accuracyMeters: 0 }),
        ping({ clientReference: "ping-good-001" }),
      ],
    });

    expect(result.accepted).toBe(1);
    expect(result.rejected).toEqual([
      { clientReference: "ping-bad-0001", reason: "invalid_coordinates" },
    ]);
  });

  it("counts a replayed offline batch as duplicates rather than writing twice", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });
    prisma.workdaySession.findFirst.mockResolvedValue(openSession());
    // The unique index skips what is already stored, so nothing is written.
    prisma.locationPing.createMany.mockResolvedValue({ count: 0 });

    const result = await new TrackingService(prisma).ingest({
      salespersonId: "staff-1",
      pings: [ping()],
    });

    expect(result).toMatchObject({ accepted: 0, duplicates: 1 });
  });

  it("attaches accepted pings to the open session", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });
    prisma.workdaySession.findFirst.mockResolvedValue(openSession());
    prisma.locationPing.createMany.mockResolvedValue({ count: 1 });

    await new TrackingService(prisma).ingest({ salespersonId: "staff-1", pings: [ping()] });

    // One insert for the whole batch, not one per reading.
    expect(prisma.locationPing.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.locationPing.createMany.mock.calls[0][0]).toMatchObject({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          workdaySessionId: "session-1",
          salespersonId: "staff-1",
          clientReference: "ping-00000001",
        }),
      ],
    });
  });

  it("accepts an empty batch without touching the database", async () => {
    const prisma = fakePrisma();
    prisma.appConfig.findUnique.mockResolvedValue({ locationTrackingEnabled: true });

    const result = await new TrackingService(prisma).ingest({ salespersonId: "staff-1", pings: [] });
    expect(result).toEqual({ accepted: 0, duplicates: 0, rejected: [] });
    expect(prisma.workdaySession.findFirst).not.toHaveBeenCalled();
  });
});

describe("tracking history", () => {
  it("returns nothing for a day the salesperson never started", async () => {
    const prisma = fakePrisma();
    prisma.workdaySession.findUnique.mockResolvedValue(null);

    const history = await new TrackingService(prisma).history({
      salespersonId: "staff-1",
      date: new Date("2026-03-10T00:00:00Z"),
    });
    expect(history).toEqual({ session: null, pings: [] });
    expect(prisma.locationPing.findMany).not.toHaveBeenCalled();
  });
});
