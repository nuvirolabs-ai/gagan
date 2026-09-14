// Local device acceptance must not replace a user's installed staging app/data.
module.exports = ({ config }) => {
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
