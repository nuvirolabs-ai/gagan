/**
 * Non-secret build identity baked into review bundles at build time.
 *
 * These values are intentionally read-only and contain no credentials. A
 * locally started app is clearly marked as unpublished rather than being
 * mistaken for a review artifact.
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
