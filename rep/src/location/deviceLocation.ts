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

  // 1. Try fast last known position first if it is fresh (< 2 mins) and accurate (<= 50m)
  if (typeof Location.getLastKnownPositionAsync === "function") {
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 100 });
      if (
        lastKnown &&
        Number.isFinite(lastKnown.coords.latitude) &&
        Number.isFinite(lastKnown.coords.longitude) &&
        lastKnown.coords.accuracy &&
        lastKnown.coords.accuracy <= 50
      ) {
        return {
          kind: "captured",
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracyMeters: lastKnown.coords.accuracy,
          capturedAt: lastKnown.timestamp,
          devicePlatform: process.env.EXPO_OS ?? "unknown",
        };
      }
    } catch {
      // Continue to fresh fix
    }
  }

  // 2. Fetch fresh position with a strict 6-second timeout promise
  try {
    const accuracy = Location.Accuracy?.Balanced ?? Location.Accuracy?.High ?? 4;
    const freshReadingPromise = Location.getCurrentPositionAsync({ accuracy });
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
    const reading = await Promise.race([freshReadingPromise, timeoutPromise]);

    if (
      reading &&
      Number.isFinite(reading.coords.latitude) &&
      Number.isFinite(reading.coords.longitude) &&
      reading.coords.accuracy &&
      reading.coords.accuracy > 0
    ) {
      return {
        kind: "captured",
        latitude: reading.coords.latitude,
        longitude: reading.coords.longitude,
        accuracyMeters: reading.coords.accuracy,
        capturedAt: reading.timestamp,
        devicePlatform: process.env.EXPO_OS ?? "unknown",
      };
    }

    // 3. If timeout hit or accuracy low, fall back to last known position
    if (typeof Location.getLastKnownPositionAsync === "function") {
      const fallback = await Location.getLastKnownPositionAsync();
      if (fallback && Number.isFinite(fallback.coords.latitude) && Number.isFinite(fallback.coords.longitude) && fallback.coords.accuracy) {
        return {
          kind: "captured",
          latitude: fallback.coords.latitude,
          longitude: fallback.coords.longitude,
          accuracyMeters: fallback.coords.accuracy,
          capturedAt: fallback.timestamp,
          devicePlatform: process.env.EXPO_OS ?? "unknown",
        };
      }
    }

    return { kind: "unavailable", message: "Your device could not provide a reliable location. Move near a window or storefront and try again." };
  } catch {
    return { kind: "unavailable", message: "Location is unavailable right now. Move near the storefront and try again." };
  }
}
