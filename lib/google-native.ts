import { GOOGLE_AUTH_CONFIG } from "./google-auth-config";

/** Loaded only from native event handlers; web keeps its browser OAuth flow. */
export async function getNativeGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, statusCodes } =
    require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({
    webClientId: GOOGLE_AUTH_CONFIG.webClientId,
    iosClientId: GOOGLE_AUTH_CONFIG.iosClientId,
    offlineAccess: false,
  });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type === "cancelled") return null;
    if (!result.data.idToken)
      throw new Error(
        "Google no devolvió una sesión válida. Volvé a intentar.",
      );
    return result.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED)
      return null;
    throw error;
  }
}

export async function clearNativeGoogleSession() {
  const { GoogleSignin } =
    require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  await GoogleSignin.signOut();
}
