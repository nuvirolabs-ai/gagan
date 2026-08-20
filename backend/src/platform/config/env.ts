import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),
  SMS_PROVIDER: z.string().min(1).default("mock"),
  PAYMENT_PROVIDER: z.string().min(1).default("mock"),
  SAP_MODE: z.string().min(1).default("disabled"),
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
  }

  return env;
}

export function loadEnv(): AppEnv {
  return parseEnv(process.env);
}
