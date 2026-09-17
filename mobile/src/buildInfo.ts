/**
 * Non-secret build identity baked into review bundles at build time.
 *
 * It is available to support exact APK provenance without putting credentials
 * or operational configuration into the client-facing experience.
 */
export const buildInfo = {
  sourceSha: process.env.EXPO_PUBLIC_BUILD_SOURCE_SHA ?? "unpublished",
  version: process.env.EXPO_PUBLIC_BUILD_VERSION ?? "development",
  channel: process.env.EXPO_PUBLIC_BUILD_CHANNEL ?? "local",
  api: process.env.EXPO_PUBLIC_API_URL ?? "unconfigured",
};

export function buildApiLabel(api: string) {
  return api.replace(/^https?:\/\//, "").replace(/\/$/, "") || "unconfigured";
}
