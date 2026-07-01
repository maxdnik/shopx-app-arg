const base = require("./app.json");

module.exports = ({ config }) => {
  const expo = base.expo || {};

  return {
    ...config,
    ...expo,
    scheme: "shopxapp",
    ios: {
      ...(expo.ios || {}),
      bundleIdentifier: "com.maximodimnik.shopx",
      infoPlist: {
        ...(expo.ios?.infoPlist || {}),
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    plugins: Array.isArray(expo.plugins) ? expo.plugins : [],
  };
};
