import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../config";

describe("staff API configuration", () => {
  it("requires an HTTPS API URL outside development", () => {
    expect(() => resolveApiBaseUrl("http://api.gagan.test", false, "android")).toThrow("HTTPS");
    expect(() => resolveApiBaseUrl(undefined, false, "android")).toThrow("EXPO_PUBLIC_API_URL");
    expect(resolveApiBaseUrl("https://api.gagan.test/", false, "android")).toBe("https://api.gagan.test");
  });
});
