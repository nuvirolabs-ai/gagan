export interface SmsProvider {
  sendOtp(phone: string, code: string, correlationId: string): Promise<void>;
}

export function createSmsProvider(
  providerName: string,
  environment: "development" | "test" | "staging" | "production",
  providers: Record<string, SmsProvider>
): SmsProvider {
  if (environment === "production" && providerName.toLowerCase() === "mock") {
    throw new Error("Mock SMS provider is forbidden in production");
  }
  const provider = providers[providerName];
  if (!provider) throw new Error(`Unsupported SMS provider: ${providerName}`);
  return provider;
}
