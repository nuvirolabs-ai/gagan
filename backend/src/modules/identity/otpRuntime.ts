import { loadEnv } from "../../platform/config/env";
import { OtpService } from "./otpService";
import { MockSmsProvider } from "./providers/mockSmsProvider";
import { createSmsProvider } from "./providers/provider";
import type { OtpRouteService } from "./otpRoutes";

let cachedService: OtpService | undefined;

export function identityOtpService(): OtpService {
  if (cachedService) return cachedService;
  const env = loadEnv();
  const provider = createSmsProvider(env.SMS_PROVIDER, env.NODE_ENV, {
    mock: new MockSmsProvider(),
  });
  cachedService = new OtpService({
    provider,
    hashSecret: env.JWT_SECRET,
    codeGenerator:
      env.SMS_PROVIDER === "mock"
        ? () => process.env.MOCK_OTP ?? "123456"
        : undefined,
  });
  return cachedService;
}

export const lazyIdentityOtpService: OtpRouteService = {
  request(input) {
    return identityOtpService().request(input);
  },
  verify(input) {
    return identityOtpService().verify(input);
  },
};
