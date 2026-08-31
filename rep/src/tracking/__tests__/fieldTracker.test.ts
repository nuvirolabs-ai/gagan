import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAMPLING,
  decideSample,
  metersBetween,
  trackingBanner,
  type TrackerReading,
} from "../fieldTracker";

const reading = (overrides: Partial<TrackerReading> = {}): TrackerReading => ({
  latitude: 18.52,
  longitude: 73.85,
  accuracyMeters: 15,
  recordedAt: Date.parse("2026-03-10T10:00:00Z"),
  ...overrides,
});

describe("sampling decisions", () => {
  it("records the first reading of a day", () => {
    expect(decideSample({ reading: reading(), last: null, policy: DEFAULT_SAMPLING })).toEqual({
      record: true,
    });
  });

  it("drops a reading the device says is unreliable", () => {
    expect(
      decideSample({
        reading: reading({ accuracyMeters: 500 }),
        last: null,
        policy: DEFAULT_SAMPLING,
      })
    ).toEqual({ record: false, reason: "inaccurate" });
  });

  it("drops a reading taken before the interval has passed", () => {
    expect(
      decideSample({
        reading: reading({ recordedAt: Date.parse("2026-03-10T10:02:00Z") }),
        last: reading(),
        policy: DEFAULT_SAMPLING,
      })
    ).toEqual({ record: false, reason: "too_soon" });
  });

  it("drops a phone sitting still", () => {
    expect(
      decideSample({
        reading: reading({
          recordedAt: Date.parse("2026-03-10T10:10:00Z"),
          latitude: 18.520_05,
        }),
        last: reading(),
        policy: DEFAULT_SAMPLING,
      })
    ).toEqual({ record: false, reason: "stationary" });
  });

  it("records real movement after the interval", () => {
    expect(
      decideSample({
        reading: reading({ recordedAt: Date.parse("2026-03-10T10:10:00Z"), latitude: 18.56 }),
        last: reading(),
        policy: DEFAULT_SAMPLING,
      })
    ).toEqual({ record: true });
  });
});

describe("distance", () => {
  it("measures a couple of Pune kilometres to within a few metres", () => {
    // Kothrud to Baner, roughly 6 km apart.
    const distance = metersBetween(
      { latitude: 18.5074, longitude: 73.8077 },
      { latitude: 18.559, longitude: 73.7868 }
    );
    expect(distance).toBeGreaterThan(5_500);
    expect(distance).toBeLessThan(6_500);
  });

  it("is zero for the same point", () => {
    expect(metersBetween({ latitude: 18.5, longitude: 73.8 }, { latitude: 18.5, longitude: 73.8 })).toBe(0);
  });
});

describe("what the salesperson is told", () => {
  it("says plainly when the route is being recorded", () => {
    const banner = trackingBanner({ tracking: true, reason: "tracking_active" });
    expect(banner.tone).toBe("active");
    expect(banner.title).toMatch(/on/i);
    expect(banner.body).toMatch(/stops when you end your day/i);
  });

  it("says plainly when nothing is recorded off duty", () => {
    const banner = trackingBanner({ tracking: false, reason: "off_duty" });
    expect(banner.body).toMatch(/Nothing is recorded while you are off duty/i);
  });

  it("names the organisation policy when tracking is switched off", () => {
    expect(trackingBanner({ tracking: false, reason: "policy_disabled" }).body).toMatch(
      /turned off route recording/i
    );
  });

  it("asks for permission rather than failing silently", () => {
    expect(trackingBanner({ tracking: false, reason: "permission_required" })).toMatchObject({
      tone: "attention",
    });
  });

  it("mentions readings still waiting to sync", () => {
    expect(
      trackingBanner({ tracking: true, reason: "tracking_active", pendingUploads: 3 }).body
    ).toMatch(/3 readings waiting to sync/);
  });
});
