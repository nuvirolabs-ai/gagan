export type ApiPlatform = "ios" | "android" | "web" | "windows" | "macos";

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
  return platform === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
}
