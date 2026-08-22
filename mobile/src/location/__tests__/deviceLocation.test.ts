import { describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import { captureForegroundLocation } from "../deviceLocation";

vi.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
  Accuracy: { High: 6 },
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

describe("foreground device location", () => {
  it("returns a permission-denied state without reading coordinates", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "denied", canAskAgain: false } as any);
    const result = await captureForegroundLocation();
    expect(result).toEqual({ kind: "permission_denied", canAskAgain: false });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("returns the high-accuracy foreground reading", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "granted", canAskAgain: true } as any);
    vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 18.52, longitude: 73.85, accuracy: 12 }, timestamp: 123 } as any);
    await expect(captureForegroundLocation()).resolves.toMatchObject({ kind: "captured", latitude: 18.52, longitude: 73.85, accuracyMeters: 12, capturedAt: 123, devicePlatform: expect.any(String) });
  });
});
