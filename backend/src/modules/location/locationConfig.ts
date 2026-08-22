export interface LocationConfig {
  maxAccuracyMeters: number;
  verifiedRadiusMeters: number;
  reviewRadiusMeters: number;
}

function positiveNumber(name: string, raw: string | undefined, fallback: number) {
  const value = raw == null || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

export function parseLocationConfig(input: Record<string, string | undefined>): LocationConfig {
  const config = {
    maxAccuracyMeters: positiveNumber(
      "STORE_LOCATION_MAX_ACCURACY_METERS",
      input.STORE_LOCATION_MAX_ACCURACY_METERS,
      50
    ),
    verifiedRadiusMeters: positiveNumber(
      "VISIT_VERIFIED_RADIUS_METERS",
      input.VISIT_VERIFIED_RADIUS_METERS,
      150
    ),
    reviewRadiusMeters: positiveNumber(
      "VISIT_REVIEW_RADIUS_METERS",
      input.VISIT_REVIEW_RADIUS_METERS,
      500
    ),
  };
  if (config.verifiedRadiusMeters > config.reviewRadiusMeters) {
    throw new Error(
      "VISIT_VERIFIED_RADIUS_METERS must be less than or equal to VISIT_REVIEW_RADIUS_METERS"
    );
  }
  return config;
}

export function loadLocationConfig() {
  return parseLocationConfig(process.env);
}
