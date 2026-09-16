// Review builds must not replace a user's installed staging app/data.
module.exports = ({ config }) => {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
  const localReview = process.env.GAGAN_LOCAL_REVIEW === "1";
  const stagingReview = process.env.GAGAN_STAGING_REVIEW === "1";
  if (!localReview && !stagingReview) return config;
  if (localReview && apiUrl !== "http://127.0.0.1:4410") {
    throw new Error("Local review profile requires the isolated local UAT API");
  }
  if (stagingReview && ![
    "https://gagan-srat.onrender.com",
    "https://gagan-staging-api.onrender.com",
  ].includes(apiUrl)) {
    throw new Error("Staging review profile requires an approved Gagan staging API");
  }
  return {
    ...config,
    name: `${config.name} Review`,
    scheme: `${config.scheme}review`,
    android: { ...config.android, package: `${config.android.package}.review` },
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.review` },
  };
};
