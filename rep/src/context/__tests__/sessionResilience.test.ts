import { describe, expect, it } from "vitest";
import { SessionFetchError, isAuthenticationFailure } from "../../auth/sessionFetch";

describe("restoring a stored session on launch", () => {
  it("ends the session when the server rejects it", () => {
    expect(isAuthenticationFailure(new SessionFetchError(401, { error: "session_required" }))).toBe(true);
    expect(isAuthenticationFailure(new SessionFetchError(403, { error: "permission_required" }))).toBe(true);
  });

  it("keeps the session when the phone simply has no signal", () => {
    expect(isAuthenticationFailure(new TypeError("Network request failed"))).toBe(false);
  });

  it("keeps the session through a server-side outage", () => {
    expect(isAuthenticationFailure(new SessionFetchError(503, { error: "unavailable" }))).toBe(false);
    expect(isAuthenticationFailure(new SessionFetchError(500, {}))).toBe(false);
  });
});
