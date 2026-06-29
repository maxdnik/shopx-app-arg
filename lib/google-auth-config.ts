// lib/google-auth-config.ts

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  "935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com";

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  "935352834479-tf3habem4sk9nl3ut82c9b1ocvjt7t8k.apps.googleusercontent.com";

const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

function buildGoogleIosReverseClientId(clientId: string) {
  const cleanClientId = String(clientId || "")
    .trim()
    .replace(".apps.googleusercontent.com", "");

  if (!cleanClientId) return "";

  if (cleanClientId.startsWith("com.googleusercontent.apps.")) {
    return cleanClientId;
  }

  return `com.googleusercontent.apps.${cleanClientId}`;
}

const GOOGLE_IOS_REVERSE_CLIENT_ID =
  buildGoogleIosReverseClientId(GOOGLE_IOS_CLIENT_ID);

export const GOOGLE_AUTH_CONFIG = {
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  androidClientId: GOOGLE_ANDROID_CLIENT_ID,

  // Used for non-Google redirects and Android fallback.
  redirectScheme: "shopxapp",

  // iOS native OAuth redirect scheme from Google Client ID.
  iosReverseClientId: GOOGLE_IOS_REVERSE_CLIENT_ID,
  iosRedirectUri: `${GOOGLE_IOS_REVERSE_CLIENT_ID}:/oauthredirect`,
};
