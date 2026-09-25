import { SessionFetchError } from "./sessionFetch";

const RECOVERABLE_OTP_CODES = new Set(["challenge_expired", "challenge_used", "invalid_challenge"]);

export function otpErrorCode(error: unknown): string | null {
  if (error instanceof SessionFetchError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return null;
}

/** An old challenge can be replaced with a fresh request and the same code. */
export function isRecoverableOtpError(error: unknown): boolean {
  const code = otpErrorCode(error);
  return code !== null && RECOVERABLE_OTP_CODES.has(code);
}
