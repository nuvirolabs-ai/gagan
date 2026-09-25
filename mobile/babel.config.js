module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    // Expo owns this pinned preset in the current npm tree; resolve it from
    // there so standalone release bundles apply the same transform as Expo.
    presets: [require.resolve("expo/node_modules/babel-preset-expo")],
  };
};
