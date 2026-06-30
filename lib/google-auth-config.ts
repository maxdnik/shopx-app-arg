// lib/google-auth-config.ts
// Google Sign-In production constants.
//
// IMPORTANTE:
// El error de TestFlight "Error 401: invalid_client / The OAuth client was not found"
// sucede antes de llegar al backend. Google está rechazando el OAuth Client ID iOS.
// Por eso NO dejamos un fallback hardcodeado para iOS: el build debe usar el Client ID real
// creado en Google Cloud para el bundleIdentifier com.maximodimnik.shopx.

const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

function clean(value: unknown) {
  return String(value || "").trim();
}

function reverseGoogleClientId(clientId: string) {
  const cleanClientId = clean(clientId).replace(
    new RegExp(`${GOOGLE_CLIENT_ID_SUFFIX.replace(/\./g, "\\.")}$`),
    ""
  );

  return cleanClientId ? `com.googleusercontent.apps.${cleanClientId}` : "";
}

const webClientId =
  clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) ||
  clean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) ||
  // Web OAuth Client ID usado por NextAuth / backend.
  // Si lo cambiás en Google Cloud, actualizalo también en Vercel.
  "935352834479-pdl30nl91se82noe814lup4gv4o9or03.apps.googleusercontent.com";

const iosClientId = clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
const androidClientId = clean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
const iosReverseClientId =
  clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID) ||
  reverseGoogleClientId(iosClientId);

export const GOOGLE_AUTH_CONFIG = {
  webClientId,
  iosClientId,
  androidClientId,
  redirectScheme: "shopxapp",
  iosReverseClientId,
  iosRedirectUri: iosReverseClientId
    ? `${iosReverseClientId}:/oauth2redirect/google`
    : "",
};

export function getGoogleAuthConfigError() {
  if (!GOOGLE_AUTH_CONFIG.webClientId) {
    return "Falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID o GOOGLE_CLIENT_ID.";
  }

  if (!GOOGLE_AUTH_CONFIG.webClientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    return "El Google Web Client ID no tiene formato válido.";
  }

  if (!GOOGLE_AUTH_CONFIG.iosClientId) {
    return "Falta EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. Creá un OAuth Client ID de tipo iOS para com.maximodimnik.shopx y cargalo antes de hacer el build.";
  }

  if (!GOOGLE_AUTH_CONFIG.iosClientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    return "El Google iOS Client ID no tiene formato válido.";
  }

  if (!GOOGLE_AUTH_CONFIG.iosReverseClientId) {
    return "Falta EXPO_PUBLIC_GOOGLE_IOS_REVERSED_CLIENT_ID.";
  }

  return null;
}
