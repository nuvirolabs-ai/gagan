type EnvironmentConfig = { DEV: boolean; VITE_APP_ENV?: string };

export function environmentLabel(config: EnvironmentConfig): string {
  if (config.DEV) return "local development";
  const configured = config.VITE_APP_ENV?.trim().toLowerCase();
  if (configured === "staging" || configured === "production") return configured;
  if (configured === "local" || configured === "development") return "local development";
  return "environment unconfigured";
}

export const APP_ENVIRONMENT_LABEL = environmentLabel(import.meta.env);
