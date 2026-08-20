import type { SmsProvider } from "./provider";

/** Development-only adapter. Deliberately does not log or persist OTP values. */
export class MockSmsProvider implements SmsProvider {
  async sendOtp(_phone: string, _code: string, _correlationId: string): Promise<void> {
    return undefined;
  }
}
