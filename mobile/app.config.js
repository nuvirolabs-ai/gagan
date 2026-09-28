// Local device acceptance must not replace a user's installed staging app/data.
module.exports = ({ config }) => {
  if (process.env.GAGAN_HOSTED_REVIEW === "1") {
    if (process.env.EXPO_PUBLIC_API_URL !== "https://gagan-srat.onrender.com") {
      throw new Error("Hosted review profile requires the client-owned staging API");
    }
    const reviewVersionCode = Number(process.env.GAGAN_REVIEW_VERSION_CODE);
    const versionCode = Number.isInteger(reviewVersionCode) && reviewVersionCode > 0
      ? reviewVersionCode
      : 31;
    return {
      ...config,
      name: "Gagan Retailer Review",
      version: process.env.GAGAN_REVIEW_VERSION_NAME || "1.0.31",
      scheme: "gaganretailerreview",
      android: { ...config.android, package: `${config.android.package}.review`, versionCode },
      ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.review` },
    };
  }
  if (process.env.GAGAN_CLIENT_UAT === "1") {
    const expectedApiUrl = "https://gagan-client-uat-api.onrender.com";
    if (process.env.EXPO_PUBLIC_API_URL !== expectedApiUrl) {
      throw new Error("Client UAT profile requires the isolated Client UAT API");
    }
    const reviewVersionCode = Number(process.env.GAGAN_CLIENT_UAT_VERSION_CODE);
    const versionCode = Number.isInteger(reviewVersionCode) && reviewVersionCode > 0 ? reviewVersionCode : 100;
    return {
      ...config,
      name: "Gagan Retailer CLIENT UAT",
      version: process.env.GAGAN_CLIENT_UAT_VERSION_NAME || "1.0.0-client-uat",
      scheme: "gaganretailerclientuat",
      android: { ...config.android, package: `${config.android.package}.clientuat`, versionCode },
      ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.clientuat` },
    };
  }
  if (process.env.GAGAN_LOCAL_REVIEW !== "1") return config;
  if (process.env.EXPO_PUBLIC_API_URL !== "http://127.0.0.1:4410") {
    throw new Error("Local review profile requires the isolated local UAT API");
  }
  return {
    ...config,
    name: `${config.name} Review`,
    scheme: `${config.scheme}review`,
    android: { ...config.android, package: `${config.android.package}.review` },
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.review` },
  };
};
