/** Non-secret build identity embedded in review bundles at build time. */
export const buildInfo = {
  sourceSha: process.env.EXPO_PUBLIC_BUILD_SOURCE_SHA ?? "unpublished",
  version: process.env.EXPO_PUBLIC_BUILD_VERSION ?? "development",
  channel: process.env.EXPO_PUBLIC_BUILD_CHANNEL ?? "local",
  api: process.env.EXPO_PUBLIC_API_URL ?? "unconfigured",
};

export function buildApiLabel(api: string) {
  return api.replace(/^https?:\/\//, "").replace(/\/$/, "") || "unconfigured";
}
