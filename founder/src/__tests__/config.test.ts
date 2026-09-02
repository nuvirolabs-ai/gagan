import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "../api/config";
import { friendlyError, pulseViewState } from "../pulse/viewState";

describe("founder api config", () => {
  it("requires https outside development and never silently uses localhost there", () => {
    expect(resolveApiBaseUrl("https://gagan-staging-api.onrender.com", false, "ios")).toBe(
      "https://gagan-staging-api.onrender.com"
    );
    expect(() => resolveApiBaseUrl("http://localhost:4000", false, "ios")).toThrow(/HTTPS/);
    expect(resolveApiBaseUrl(undefined, false, "web")).toBe("");
    expect(() => resolveApiBaseUrl(undefined, false, "android")).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(resolveApiBaseUrl(undefined, true, "ios")).toContain("localhost:4000");
  });
});

describe("pulse view states", () => {
  it("keeps layout states distinct and never surfaces raw codes", () => {
    expect(pulseViewState({ loading: true, error: null, pulse: null }).status).toBe("loading");
    expect(pulseViewState({ loading: false, error: "x", pulse: null }).status).toBe("error");
    expect(friendlyError(new Error("permission_required"))).toBe("This account is not authorised for Founder.");
    expect(friendlyError(new Error("ECONNREFUSED"))).not.toMatch(/ECONNREFUSED/);
  });
});
