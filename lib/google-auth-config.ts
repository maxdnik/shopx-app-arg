// lib/google-auth-config.ts
// Google Sign-In production constants.
// Do not read EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID here: EAS secret env vars previously overrode the correct iOS client.

export const GOOGLE_AUTH_CONFIG = {
  webClientId: "935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com",
  iosClientId: "935352834479-alqde8iks44c9l892mm1nmrrmt65vdgqc.apps.googleusercontent.com",
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
  redirectScheme: "shopxapp",
  iosReverseClientId: "com.googleusercontent.apps.935352834479-alqde8iks44c9l892mm1nmrrmt65vdgqc",
  iosRedirectUri: "com.googleusercontent.apps.935352834479-alqde8iks44c9l892mm1nmrrmt65vdgqc:/oauth2redirect/google",
};
