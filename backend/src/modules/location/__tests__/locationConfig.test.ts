import { describe, expect, it } from "vitest";
import { parseLocationConfig } from "../locationConfig";

describe("location configuration", () => {
  it("uses safe foreground-location defaults", () => {
    expect(parseLocationConfig({})).toEqual({
      maxAccuracyMeters: 50,
      verifiedRadiusMeters: 150,
      reviewRadiusMeters: 500,
    });
  });

  it("parses configured thresholds", () => {
    expect(
      parseLocationConfig({
        STORE_LOCATION_MAX_ACCURACY_METERS: "35",
        VISIT_VERIFIED_RADIUS_METERS: "100",
        VISIT_REVIEW_RADIUS_METERS: "300",
      })
    ).toEqual({ maxAccuracyMeters: 35, verifiedRadiusMeters: 100, reviewRadiusMeters: 300 });
  });

  it("rejects unsafe threshold ordering and values", () => {
    expect(() => parseLocationConfig({ VISIT_VERIFIED_RADIUS_METERS: "600" })).toThrow(
      "VISIT_VERIFIED_RADIUS_METERS must be less than or equal to VISIT_REVIEW_RADIUS_METERS"
    );
    expect(() => parseLocationConfig({ STORE_LOCATION_MAX_ACCURACY_METERS: "0" })).toThrow(
      "STORE_LOCATION_MAX_ACCURACY_METERS must be a positive number"
    );
  });
});
