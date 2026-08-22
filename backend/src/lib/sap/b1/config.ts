import { z } from "zod";

export class SapB1ConfigurationError extends Error {
  readonly code = "sap_b1_configuration_error";

  constructor(message: string) {
    super(message);
    this.name = "SapB1ConfigurationError";
  }
}

export interface SapB1Config {
  baseUrl: string;
  companyDb: string;
  authMode: string;
  username: string;
  password: string;
  defaultWarehouse: string;
}

const futureConfigSchema = z.object({
  SAP_B1_BASE_URL: z.string().url().refine((value) => value.startsWith("https://"), "must use HTTPS"),
  SAP_B1_COMPANY_DB: z.string().min(1),
  SAP_B1_AUTH_MODE: z.string().min(1),
  SAP_B1_USERNAME: z.string().min(1),
  SAP_B1_PASSWORD: z.string().min(1),
  SAP_B1_DEFAULT_WAREHOUSE: z.string().min(1),
});

export function parseSapB1Config(input: Record<string, string | undefined>): SapB1Config {
  const parsed = futureConfigSchema.safeParse(input);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new SapB1ConfigurationError(`SAP_MODE=service-layer requires valid SAP B1 configuration: ${missing}`);
  }
  return {
    baseUrl: parsed.data.SAP_B1_BASE_URL,
    companyDb: parsed.data.SAP_B1_COMPANY_DB,
    authMode: parsed.data.SAP_B1_AUTH_MODE,
    username: parsed.data.SAP_B1_USERNAME,
    password: parsed.data.SAP_B1_PASSWORD,
    defaultWarehouse: parsed.data.SAP_B1_DEFAULT_WAREHOUSE,
  };
}
