// lib/google-auth-config.ts

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com";

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  "935352834479-alqde8iks44c9l892mm1nmrrmt65vdgqc.apps.googleusercontent.com";

const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

const GOOGLE_IOS_REVERSE_CLIENT_ID =
  "com.googleusercontent.apps." +
  GOOGLE_IOS_CLIENT_ID.replace(".apps.googleusercontent.com", "");

export const GOOGLE_AUTH_CONFIG = {
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  redirectScheme: "shopxapp",
  iosReverseClientId: GOOGLE_IOS_REVERSE_CLIENT_ID,
  iosRedirectUri: `${GOOGLE_IOS_REVERSE_CLIENT_ID}:/oauth2redirect/google`,
};
