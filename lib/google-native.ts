import { GOOGLE_AUTH_CONFIG } from "./google-auth-config";
import Constants, { ExecutionEnvironment } from "expo-constants";

/** Loaded only from native event handlers; web keeps its browser OAuth flow. */
export async function getNativeGoogleIdToken(): Promise<string | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    throw new Error("En Expo Go ingresá con email y contraseña. El inicio con Google está disponible en la app instalada de ShopX.");
  }
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
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
  const { GoogleSignin } =
    require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  await GoogleSignin.signOut();
}
