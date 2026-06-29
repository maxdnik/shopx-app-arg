// lib/google-auth-config.ts

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com";

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  "935352834479-tf3habem4sk9nl3ut82c9b1ocvjt7t8k.apps.googleusercontent.com";

const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

export const GOOGLE_AUTH_CONFIG = {
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  redirectScheme: "shopxapp",
  iosReverseClientId: "com.googleusercontent.apps.935352834479-tf3habem4sk9nl3ut82c9b1ocvjt7t8k",
  iosRedirectUri: "com.googleusercontent.apps.935352834479-tf3habem4sk9nl3ut82c9b1ocvjt7t8k:/oauthredirect",
};
