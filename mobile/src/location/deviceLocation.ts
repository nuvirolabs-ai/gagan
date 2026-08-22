import * as Location from "expo-location";

export type DeviceLocationResult =
  | { kind: "captured"; latitude: number; longitude: number; accuracyMeters: number; capturedAt: number; devicePlatform: string }
  | { kind: "permission_denied"; canAskAgain: boolean }
  | { kind: "unavailable"; message: string };

export async function captureForegroundLocation(): Promise<DeviceLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return { kind: "permission_denied", canAskAgain: permission.canAskAgain };
  }
  try {
    const reading = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const accuracyMeters = reading.coords.accuracy;
    if (!Number.isFinite(reading.coords.latitude) || !Number.isFinite(reading.coords.longitude) || !accuracyMeters || accuracyMeters <= 0) {
      return { kind: "unavailable", message: "Your device could not provide a reliable location." };
    }
    return {
      kind: "captured",
      latitude: reading.coords.latitude,
      longitude: reading.coords.longitude,
      accuracyMeters,
      capturedAt: reading.timestamp,
      devicePlatform: process.env.EXPO_OS ?? "unknown",
    };
  } catch {
    return { kind: "unavailable", message: "Location is unavailable right now. Move near the storefront and try again." };
  }
}
