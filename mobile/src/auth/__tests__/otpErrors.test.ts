import { describe, expect, it } from "vitest";
import { SessionFetchError } from "../sessionFetch";
import { isRecoverableOtpError, otpErrorCode } from "../otpErrors";

describe("retailer otp errors", () => {
  it("reads the server code off a session error", () => {
    expect(otpErrorCode(new SessionFetchError(401, { error: "invalid_challenge" }))).toBe(
      "invalid_challenge"
    );
  });

  it("does not surface the raw backend code as the only user copy", () => {
    expect(otpErrorCode(new SessionFetchError(401, { error: "invalid_challenge" }))).not.toBeNull();
    expect(isRecoverableOtpError(new SessionFetchError(401, { error: "invalid_challenge" }))).toBe(
      true
    );
    expect(isRecoverableOtpError(new SessionFetchError(401, { error: "incorrect_code" }))).toBe(
      false
    );
  });
});
