// lib/google-auth-config.ts

const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  "935352834479-tf3habem4sk9nl3ut82c9b1ocvjt7t8k.apps.googleusercontent.com";

const iosReverseClientId = iosClientId
  .replace(".apps.googleusercontent.com", "")
  .split(".")
  .reverse()
  .join(".");

export const GOOGLE_AUTH_CONFIG = {
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com",

  iosClientId,

  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",

  redirectScheme: "shopxapp",

  iosReverseClientId,

  // Google iOS OAuth expects a valid native redirect URI scheme.
  // This uses the reverse client ID format:
  // com.googleusercontent.apps.<client-id-without-domain>:/oauth2redirect/google
  iosRedirectUri: `${iosReverseClientId}:/oauth2redirect/google`,
};
