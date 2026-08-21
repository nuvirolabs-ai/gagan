export interface CoordinateInput {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  devicePlatform?: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type VisitVerificationStatus =
  | "VERIFIED"
  | "NEEDS_REVIEW"
  | "OUTSIDE_STORE_AREA"
  | "STORE_LOCATION_NOT_AVAILABLE"
  | "LOW_GPS_ACCURACY";

export function validateCoordinateInput(input: CoordinateInput): CoordinateInput {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error("invalid_latitude");
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("invalid_longitude");
  }
  if (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters <= 0) {
    throw new Error("invalid_accuracy");
  }
  return input;
}

const EARTH_RADIUS_METERS = 6_371_000;

export function distanceBetweenMeters(a: Coordinate, b: Coordinate): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.latitude - a.latitude);
  const longitudeDelta = toRadians(b.longitude - a.longitude);
  const latitudeA = toRadians(a.latitude);
  const latitudeB = toRadians(b.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function classifyVisitDistance(
  distanceMeters: number,
  thresholds: { verifiedRadiusMeters: number; reviewRadiusMeters: number }
): Exclude<VisitVerificationStatus, "STORE_LOCATION_NOT_AVAILABLE" | "LOW_GPS_ACCURACY"> {
  if (distanceMeters <= thresholds.verifiedRadiusMeters) return "VERIFIED";
  if (distanceMeters <= thresholds.reviewRadiusMeters) return "NEEDS_REVIEW";
  return "OUTSIDE_STORE_AREA";
}
