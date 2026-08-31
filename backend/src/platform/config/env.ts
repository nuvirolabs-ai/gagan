import { z } from "zod";
import { parseSapB1Config } from "../../lib/sap/b1/config";
import { parseLocationConfig } from "../../modules/location/locationConfig";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),
  SMS_PROVIDER: z.string().min(1).default("mock"),
  PAYMENT_PROVIDER: z.string().min(1).default("mock"),
  SAP_MODE: z.string().min(1).default("disabled"),
  SAP_B1_BASE_URL: z.string().optional(),
  SAP_B1_COMPANY_DB: z.string().optional(),
  SAP_B1_AUTH_MODE: z.string().optional(),
  SAP_B1_USERNAME: z.string().optional(),
  SAP_B1_PASSWORD: z.string().optional(),
  SAP_B1_DEFAULT_WAREHOUSE: z.string().optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  OBJECT_STORAGE_ROOT: z.string().min(1).default(".data/evidence"),
  OBJECT_STORAGE_BUCKET: z.string().min(1).optional(),
  OBJECT_STORAGE_REGION: z.string().min(1).optional(),
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1).optional(),
  STORE_LOCATION_MAX_ACCURACY_METERS: z.coerce.number().positive().default(50),
  VISIT_VERIFIED_RADIUS_METERS: z.coerce.number().positive().default(150),
  VISIT_REVIEW_RADIUS_METERS: z.coerce.number().positive().default(500),
  DISABLE_JOBS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv | Record<string, string | undefined>): AppEnv {
  const env = envSchema.parse(input);

  if (env.NODE_ENV === "production") {
    const mockProviders = [
      ["SMS_PROVIDER", env.SMS_PROVIDER],
      ["PAYMENT_PROVIDER", env.PAYMENT_PROVIDER],
      ["SAP_MODE", env.SAP_MODE],
    ].filter(([, value]) => value.toLowerCase() === "mock");

    if (mockProviders.length > 0) {
      throw new Error(
        `Mock adapters are forbidden in production: ${mockProviders.map(([name]) => name).join(", ")}`
      );
    }
    if (env.STORAGE_PROVIDER !== "s3" || !env.OBJECT_STORAGE_BUCKET) {
      throw new Error("Production requires private S3-compatible object storage");
    }
  }

  if (env.SAP_MODE.toLowerCase() === "service-layer") {
    parseSapB1Config(input);
  }

  parseLocationConfig({
    STORE_LOCATION_MAX_ACCURACY_METERS: String(env.STORE_LOCATION_MAX_ACCURACY_METERS),
    VISIT_VERIFIED_RADIUS_METERS: String(env.VISIT_VERIFIED_RADIUS_METERS),
    VISIT_REVIEW_RADIUS_METERS: String(env.VISIT_REVIEW_RADIUS_METERS),
  });

  return env;
}

export function loadEnv(): AppEnv {
  return parseEnv(process.env);
}
