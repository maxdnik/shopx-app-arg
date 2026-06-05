import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { buildApiUrl } from "./config";
import { getAuthToken } from "./auth";

export type PushRegistrationResult = {
  success: boolean;
  token?: string;
  reason?: string;
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
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    "";

  return String(projectId || "");
}

function getNotificationRoute(data?: Record<string, any>) {
  const actionRoute = String(data?.actionRoute || "").trim();

  if (actionRoute) {
    return actionRoute;
  }

  const orderId = String(data?.orderId || "").trim();
  const notificationType = String(data?.type || "").trim();

  if (orderId) {
    return `/order/${orderId}`;
  }

  if (notificationType === "order") {
    return "/orders";
  }

  if (notificationType === "favorite") {
    return "/favorites";
  }

  if (notificationType === "cart") {
    return "/cart";
  }

  return "/notifications";
}

export function navigateFromPushNotification(data?: Record<string, any>) {
  try {
    const route = getNotificationRoute(data);

    setTimeout(() => {
      router.push(route as any);
    }, 250);
  } catch (error) {
    console.log("ERROR NAVIGATE FROM PUSH:", error);
  }
}

async function getNotificationPermissionStatus() {
  const currentPermissions = await Notifications.getPermissionsAsync();

  if (
    currentPermissions.status === "granted" ||
    currentPermissions.ios?.status ===
      Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return currentPermissions;
  }

  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
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
      reason: "No hay sesión activa.",
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

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  try {
    await configureAndroidNotificationChannel();

    if (!Device.isDevice) {
      return {
        success: false,
        reason:
          "Las push notifications requieren un dispositivo físico. No funcionan correctamente en simulador.",
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

    const permissions = await getNotificationPermissionStatus();

    const permissionGranted =
      permissions.status === "granted" ||
      permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

    if (!permissionGranted) {
      return {
        success: false,
        reason: "El usuario no aceptó permisos de notificaciones.",
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

    await savePushTokenToBackend(expoPushToken);

    return {
      success: true,
      token: expoPushToken,
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
  const registration = await registerForPushNotificationsAsync();

  if (!registration.success) {
    console.log("PUSH NOT REGISTERED:", registration.reason);
  }

  const removeListeners = addPushNotificationListeners();

  return {
    registration,
    removeListeners,
  };
}

export async function getLastPushNotificationResponse() {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();

    if (!response) return null;

    const data = response.notification.request.content.data as Record<
      string,
      any
    >;

    return data;
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