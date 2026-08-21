import { describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import { captureForegroundLocation } from "../deviceLocation";

vi.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
  Accuracy: { High: 6 },
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

describe("salesperson foreground location", () => {
  it("does not read a coordinate after permission is denied", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "denied", canAskAgain: false } as any);
    await expect(captureForegroundLocation()).resolves.toEqual({ kind: "permission_denied", canAskAgain: false });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("returns an accurate foreground reading", async () => {
    vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({ status: "granted", canAskAgain: true } as any);
    vi.mocked(Location.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: 18.52, longitude: 73.85, accuracy: 9 }, timestamp: 456 } as any);
    await expect(captureForegroundLocation()).resolves.toMatchObject({ kind: "captured", accuracyMeters: 9 });
  });
});
