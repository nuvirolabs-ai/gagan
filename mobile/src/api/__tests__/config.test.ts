import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../config";

describe("retailer API configuration", () => {
  it("requires an HTTPS API URL outside development", () => {
    expect(() => resolveApiBaseUrl("http://api.gagan.test", false, "ios")).toThrow("HTTPS");
    expect(() => resolveApiBaseUrl(undefined, false, "ios")).toThrow("EXPO_PUBLIC_API_URL");
    expect(resolveApiBaseUrl("https://api.gagan.test/", false, "ios")).toBe("https://api.gagan.test");
  });

  it("uses emulator-safe localhost defaults only in development", () => {
    expect(resolveApiBaseUrl(undefined, true, "android")).toBe("http://10.0.2.2:4000");
    expect(resolveApiBaseUrl(undefined, true, "ios")).toBe("http://localhost:4000");
  });
});
