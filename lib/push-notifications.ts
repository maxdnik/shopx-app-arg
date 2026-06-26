import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { buildApiUrl } from "./config";
import { getAuthToken } from "./auth";

const PUSH_PERMISSION_PROMPTED_KEY = "shopx_push_permission_prompted";

export type PushRegistrationResult = {
  success: boolean;
  token?: string;
  reason?: string;
  permissionStatus?: string;
  saved?: boolean;
};

type RegisterPushOptions = {
  /**
   * Si es true, iOS/Android muestran el permiso nativo dentro de la app.
   * Si es false, solo registra token si el permiso ya estaba otorgado.
   */
  requestPermissions?: boolean;
  /**
   * Si es true, permite volver a pedir permiso aun si ya marcamos que lo pedimos.
   * iOS solo muestra el popup una vez; si el usuario rechazó, deberá ir a Ajustes.
   */
  forcePrompt?: boolean;
};

type PushNotificationPayload = {
  title?: string;
  body?: string;
  data?: Record<string, any>;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId() {
  return String(
    Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      ""
  );
}

function getNotificationRoute(data?: Record<string, any>) {
  const actionRoute = String(data?.actionRoute || "").trim();
  if (actionRoute) return actionRoute;

  const orderId = String(data?.orderId || "").trim();
  const notificationType = String(data?.type || "").trim();

  if (orderId) return `/order/${orderId}`;
  if (notificationType === "order") return "/orders";
  if (notificationType === "favorite") return "/favorites";
  if (notificationType === "cart") return "/cart";

  return "/notifications";
}

export function navigateFromPushNotification(data?: Record<string, any>) {
  try {
    const route = getNotificationRoute(data);
    setTimeout(() => router.push(route as any), 250);
  } catch (error) {
    console.log("ERROR NAVIGATE FROM PUSH:", error);
  }
}

async function configureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "ShopX",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#18C7D8",
    sound: "default",
  });
}

async function savePushTokenToBackend(expoPushToken: string) {
  const token = await getAuthToken();

  if (!token) {
    return {
      saved: false,
      reason: "Necesitás iniciar sesión para registrar este dispositivo.",
    };
  }

  const response = await fetch(buildApiUrl("/api/app/push-token"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      expoPushToken,
      platform: Platform.OS,
      deviceName: Device.deviceName || "",
      deviceBrand: Device.brand || "",
      deviceModelName: Device.modelName || "",
      appOwnership: Constants.appOwnership || "",
      projectId: getExpoProjectId(),
    }),
  });

  const text = await response.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || "No pudimos guardar el push token."
    );
  }

  return {
    saved: true,
    data,
  };
}

function isPermissionGranted(
  permissions: Notifications.NotificationPermissionsStatus
) {
  return (
    permissions.status === "granted" ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function getPushPermissionStatus() {
  try {
    const permissions = await Notifications.getPermissionsAsync();

    return {
      granted: isPermissionGranted(permissions),
      status: permissions.status,
      canAskAgain: permissions.canAskAgain,
    };
  } catch (error: any) {
    return {
      granted: false,
      status: "undetermined",
      canAskAgain: true,
      reason: error?.message || "No pudimos leer el permiso de notificaciones.",
    };
  }
}

async function shouldRequestPushPermissionOnLaunch(options: RegisterPushOptions) {
  if (!options.requestPermissions) return false;

  const prompted = await AsyncStorage.getItem(PUSH_PERMISSION_PROMPTED_KEY);

  if (prompted === "1" && !options.forcePrompt) return false;

  return true;
}

export async function registerForPushNotificationsAsync(
  options: RegisterPushOptions = {}
): Promise<PushRegistrationResult> {
  try {
    await configureAndroidNotificationChannel();

    if (!Device.isDevice) {
      return {
        success: false,
        reason:
          "Las notificaciones requieren un dispositivo físico. No funcionan correctamente en simulador.",
      };
    }

    const projectId = getExpoProjectId();

    if (!projectId) {
      return {
        success: false,
        reason:
          "Falta projectId de EAS en app.json/app.config. No se puede generar ExpoPushToken.",
      };
    }

    let permissions = await Notifications.getPermissionsAsync();

    if (!isPermissionGranted(permissions)) {
      const shouldRequest = await shouldRequestPushPermissionOnLaunch(options);

      if (shouldRequest && permissions.canAskAgain !== false) {
        await AsyncStorage.setItem(PUSH_PERMISSION_PROMPTED_KEY, "1");

        permissions = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
      }
    }

    if (!isPermissionGranted(permissions)) {
      return {
        success: false,
        permissionStatus: permissions.status,
        reason: options.requestPermissions
          ? "No se otorgó permiso para enviar notificaciones."
          : "Permiso de notificaciones todavía no otorgado.",
      };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const expoPushToken = tokenResponse.data;

    if (!expoPushToken) {
      return {
        success: false,
        reason: "Expo no devolvió un push token.",
      };
    }

    const backendResult = await savePushTokenToBackend(expoPushToken);

    if (!backendResult.saved) {
      return {
        success: false,
        token: expoPushToken,
        saved: false,
        reason: backendResult.reason,
      };
    }

    return {
      success: true,
      token: expoPushToken,
      saved: true,
    };
  } catch (error: any) {
    console.log("ERROR REGISTER PUSH TOKEN:", error);

    return {
      success: false,
      reason: error?.message || "No pudimos registrar notificaciones push.",
    };
  }
}

export function addPushNotificationListeners() {
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      const payload: PushNotificationPayload = {
        title: notification.request.content.title || "",
        body: notification.request.content.body || "",
        data: notification.request.content.data as Record<string, any>,
      };

      console.log("PUSH RECEIVED:", payload);
    }
  );

  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<
        string,
        any
      >;

      console.log("PUSH OPENED:", data);

      navigateFromPushNotification(data);
    });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

export async function setupPushNotifications() {
  await configureAndroidNotificationChannel();

  const removeListeners = addPushNotificationListeners();

  // Esto muestra el permiso nativo dentro de la app en el primer inicio real.
  // Si todavía no hay sesión, no se guarda el token; después del login se reintenta.
  const registration = await registerForPushNotificationsAsync({
    requestPermissions: true,
  });

  return {
    registration,
    removeListeners,
  };
}

export async function getLastPushNotificationResponse() {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();

    if (!response) return null;

    return response.notification.request.content.data as Record<string, any>;
  } catch (error) {
    console.log("ERROR GET LAST PUSH RESPONSE:", error);
    return null;
  }
}

export async function handleInitialPushNotificationRoute() {
  const data = await getLastPushNotificationResponse();

  if (data) {
    navigateFromPushNotification(data);
  }
}
