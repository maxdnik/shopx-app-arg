import { buildApiUrl } from "./config";
import { getAuthToken } from "./auth";
import {
  ShopXNotification,
  ShopXNotificationPriority,
  ShopXNotificationType,
} from "./notifications-store";

export type BackendNotificationsResponse = {
  notifications?: ShopXNotification[];
  unreadCount?: number;
  message?: string;
  error?: string;
};

async function getAuthenticatedHeaders() {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Necesitás iniciar sesión para ver tus notificaciones.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "Respuesta inválida del servidor");
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "No pudimos obtener las notificaciones."
    );
  }

  return data as T;
}

function normalizeNotification(raw: any): ShopXNotification {
  const id = String(raw?.id || raw?._id || "");

  return {
    id,
    type: String(raw?.type || "general") as ShopXNotificationType,
    title: String(raw?.title || ""),
    message: String(raw?.message || ""),
    createdAt: String(raw?.createdAt || new Date().toISOString()),
    read: Boolean(raw?.read),
    priority: String(raw?.priority || "normal") as ShopXNotificationPriority,
    actionLabel: String(raw?.actionLabel || ""),
    actionRoute: String(raw?.actionRoute || ""),
    metadata:
      raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
  };
}

export async function fetchAppNotifications() {
  const headers = await getAuthenticatedHeaders();

  const response = await fetch(buildApiUrl("/api/app/notifications"), {
    method: "GET",
    headers,
  });

  const data = await parseJsonResponse<BackendNotificationsResponse>(response);

  const notifications = Array.isArray(data.notifications)
    ? data.notifications.map(normalizeNotification)
    : [];

  const unreadCount =
    typeof data.unreadCount === "number"
      ? data.unreadCount
      : notifications.filter((notification) => !notification.read).length;

  return {
    notifications,
    unreadCount,
  };
}

export async function markAppNotificationAsRead(notificationId: string) {
  const cleanId = String(notificationId || "").trim();

  if (!cleanId) {
    throw new Error("Falta el ID de la notificación.");
  }

  const headers = await getAuthenticatedHeaders();

  const response = await fetch(
    buildApiUrl(`/api/app/notifications/${cleanId}/read`),
    {
      method: "PATCH",
      headers,
    }
  );

  await parseJsonResponse<{ message?: string }>(response);

  return true;
}

export async function markAllAppNotificationsAsRead() {
  const headers = await getAuthenticatedHeaders();

  const response = await fetch(buildApiUrl("/api/app/notifications/read-all"), {
    method: "PATCH",
    headers,
  });

  await parseJsonResponse<{ message?: string }>(response);

  return true;
}