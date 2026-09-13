// OAuth client IDs are public configuration; EAS supplies them for production.
require("@expo/env").load(__dirname);
module.exports = ({ config }) => {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
  const iosUrlScheme = clientId
    ? `com.googleusercontent.apps.${clientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
    : process.env.EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID;
  if (!iosUrlScheme) {
    throw new Error(
      "Configure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID before building ShopX.",
    );
  }
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ["@react-native-google-signin/google-signin", { iosUrlScheme }],
    ],
  };
};
