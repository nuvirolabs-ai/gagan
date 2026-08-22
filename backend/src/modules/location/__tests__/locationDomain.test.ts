import { describe, expect, it } from "vitest";
import {
  classifyVisitDistance,
  distanceBetweenMeters,
  validateCoordinateInput,
} from "../locationDomain";

describe("location domain", () => {
  it("validates latitude, longitude and positive accuracy", () => {
    expect(validateCoordinateInput({ latitude: 18.5204, longitude: 73.8567, accuracyMeters: 12 })).toEqual({
      latitude: 18.5204,
      longitude: 73.8567,
      accuracyMeters: 12,
    });
    expect(() => validateCoordinateInput({ latitude: 91, longitude: 73, accuracyMeters: 12 })).toThrow(
      "invalid_latitude"
    );
    expect(() => validateCoordinateInput({ latitude: 18, longitude: 181, accuracyMeters: 12 })).toThrow(
      "invalid_longitude"
    );
    expect(() => validateCoordinateInput({ latitude: 18, longitude: 73, accuracyMeters: 0 })).toThrow(
      "invalid_accuracy"
    );
  });

  it("calculates geographic distance in metres", () => {
    const distance = distanceBetweenMeters(
      { latitude: 18.5204, longitude: 73.8567 },
      { latitude: 18.5213, longitude: 73.8567 }
    );
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(110);
  });

  it("classifies exact radius boundaries without mobile-side trust", () => {
    expect(classifyVisitDistance(0, { verifiedRadiusMeters: 150, reviewRadiusMeters: 500 })).toBe("VERIFIED");
    expect(classifyVisitDistance(150, { verifiedRadiusMeters: 150, reviewRadiusMeters: 500 })).toBe("VERIFIED");
    expect(classifyVisitDistance(150.01, { verifiedRadiusMeters: 150, reviewRadiusMeters: 500 })).toBe("NEEDS_REVIEW");
    expect(classifyVisitDistance(500, { verifiedRadiusMeters: 150, reviewRadiusMeters: 500 })).toBe("NEEDS_REVIEW");
    expect(classifyVisitDistance(500.01, { verifiedRadiusMeters: 150, reviewRadiusMeters: 500 })).toBe("OUTSIDE_STORE_AREA");
  });
});
