import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl, useFixturePulse } from "../config";

describe("founder API config", () => {
  it("uses localhost in iOS/web development and requires HTTPS in production", () => {
    expect(resolveApiBaseUrl(undefined, true, "ios")).toBe("http://localhost:4000");
    expect(resolveApiBaseUrl(undefined, true, "android")).toBe("http://10.0.2.2:4000");
    expect(resolveApiBaseUrl("https://api.gagan.test/", true, "ios")).toBe("https://api.gagan.test");
    expect(() => resolveApiBaseUrl(undefined, false, "ios")).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it("defaults CEO KPIs to the fixture until /founder/pulse exists", () => {
    expect(useFixturePulse(undefined)).toBe(true);
    expect(useFixturePulse("true")).toBe(true);
    expect(useFixturePulse("false")).toBe(false);
  });
});
