import { describe, expect, it } from "vitest";
import { parseEnv } from "../platform/config/env";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/gagan_test",
  JWT_SECRET: "a".repeat(32),
  REFRESH_TOKEN_SECRET: "b".repeat(32),
  SMS_PROVIDER: "mock",
  PAYMENT_PROVIDER: "mock",
  SAP_MODE: "disabled",
};

describe("parseEnv", () => {
  it("rejects a missing JWT secret", () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
  });

  it("rejects a missing refresh-token hashing secret", () => {
    expect(() => parseEnv({ ...base, REFRESH_TOKEN_SECRET: "" })).toThrow(
      /REFRESH_TOKEN_SECRET/
    );
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
      STORAGE_PROVIDER: "s3",
      OBJECT_STORAGE_BUCKET: "gagan-production",
      PORT: "4100",
      DISABLE_JOBS: "true",
    });

    expect(env.PORT).toBe(4100);
    expect(env.DISABLE_JOBS).toBe(true);
  });

  it("allows the staging API to host the single scheduler set", () => {
    const env = parseEnv({
      ...base,
      NODE_ENV: "staging",
      SAP_MODE: "mock",
      STAGING_RUN_JOBS_IN_API: "true",
    });

    expect(env.STAGING_RUN_JOBS_IN_API).toBe(true);
  });

  it("rejects local evidence storage in production", () => {
    expect(() =>
      parseEnv({
        ...base,
        NODE_ENV: "production",
        SMS_PROVIDER: "msg91",
        PAYMENT_PROVIDER: "razorpay",
        SAP_MODE: "s4hana",
        STORAGE_PROVIDER: "local",
      })
    ).toThrow(/object storage/i);
  });

  it("rejects service-layer mode without the future SAP B1 values", () => {
    expect(() => parseEnv({ ...base, SAP_MODE: "service-layer" })).toThrow("SAP_B1_BASE_URL");
  });

  it("accepts service-layer mode only when all future SAP B1 values are present", () => {
    expect(() => parseEnv({
      ...base,
      SAP_MODE: "service-layer",
      SAP_B1_BASE_URL: "https://sap.example.invalid",
      SAP_B1_COMPANY_DB: "opaque-company-db",
      SAP_B1_AUTH_MODE: "opaque-auth-mode",
      SAP_B1_USERNAME: "opaque-user",
      SAP_B1_PASSWORD: "opaque-password",
      SAP_B1_DEFAULT_WAREHOUSE: "opaque-warehouse",
    })).not.toThrow();
  });
});
