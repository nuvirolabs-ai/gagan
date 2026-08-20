import { describe, expect, it } from "vitest";
import { parseEnv } from "../platform/config/env";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/gagan_test",
  JWT_SECRET: "a".repeat(32),
  SMS_PROVIDER: "mock",
  PAYMENT_PROVIDER: "mock",
  SAP_MODE: "disabled",
};

describe("parseEnv", () => {
  it("rejects a missing JWT secret", () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
  });

  it("rejects mock providers in production", () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: "production",
        SMS_PROVIDER: "mock",
        PAYMENT_PROVIDER: "mock",
        SAP_MODE: "mock",
      })
    ).toThrow(/mock/i);
  });

  it("parses safe production configuration", () => {
    const env = parseEnv({
      ...base,
      NODE_ENV: "production",
      SMS_PROVIDER: "msg91",
      PAYMENT_PROVIDER: "razorpay",
      SAP_MODE: "s4hana",
      PORT: "4100",
      DISABLE_JOBS: "true",
    });

    expect(env.PORT).toBe(4100);
    expect(env.DISABLE_JOBS).toBe(true);
  });
});
