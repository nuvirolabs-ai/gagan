import { describe, expect, it } from "vitest";
import { SessionFetchError } from "../sessionFetch";
import { isRecoverableOtpError, otpErrorCode } from "../otpErrors";

describe("otp errors", () => {
  it("reads the server code off a session error", () => {
    expect(otpErrorCode(new SessionFetchError(401, { error: "challenge_expired" }))).toBe(
      "challenge_expired"
    );
  });

  it("treats an expired or used challenge as recoverable", () => {
    expect(isRecoverableOtpError(new SessionFetchError(401, { error: "challenge_expired" }))).toBe(
      true
    );
    expect(isRecoverableOtpError(new SessionFetchError(401, { error: "challenge_used" }))).toBe(true);
    expect(isRecoverableOtpError(new SessionFetchError(401, { error: "incorrect_code" }))).toBe(
      false
    );
  });
});
