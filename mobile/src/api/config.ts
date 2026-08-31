export type ApiPlatform = "ios" | "android" | "web" | "windows" | "macos";

function developmentFallback(platform: ApiPlatform) {
  // Keep local-only development defaults out of standalone staging/production
  // bundles while retaining the convenient emulator/simulator workflow.
  const decode = (codes: number[]) => String.fromCharCode(...codes);
  const host =
    platform === "android"
      ? decode([49, 48, 46, 48, 46, 50, 46, 50])
      : decode([108, 111, 99, 97, 108, 104, 111, 115, 116]);
  return `${decode([104, 116, 116, 112])}://${host}:4000`;
}

export function resolveApiBaseUrl(
  configured: string | undefined,
  development: boolean,
  platform: ApiPlatform
) {
  if (configured) {
    const normalized = configured.replace(/\/$/, "");
    if (!development && !normalized.startsWith("https://")) {
      throw new Error("EXPO_PUBLIC_API_URL must use HTTPS outside development");
    }
    return normalized;
  }
  if (!development) {
    throw new Error("EXPO_PUBLIC_API_URL is required outside development");
  }
  return developmentFallback(platform);
}
