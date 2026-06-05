import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATIONS_KEY = "SHOPX_NOTIFICATIONS_V1";

export type ShopXNotificationType =
  | "order"
  | "promo"
  | "general"
  | "favorite"
  | "cart"
  | "system";

export type ShopXNotificationPriority = "low" | "normal" | "high";

export type ShopXNotification = {
  id: string;
  type: ShopXNotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  priority?: ShopXNotificationPriority;
  actionLabel?: string;
  actionRoute?: string;
  metadata?: Record<string, any>;
};

type NotificationsListener = () => void;

const notificationsListeners = new Set<NotificationsListener>();

export function subscribeToNotificationsChanges(listener: NotificationsListener) {
  notificationsListeners.add(listener);

  return () => {
    notificationsListeners.delete(listener);
  };
}

function notifyNotificationsChanged() {
  notificationsListeners.forEach((listener) => listener());
}

function createNotificationId() {
  return `notification_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function sortNotifications(notifications: ShopXNotification[]) {
  return [...notifications].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();

    return dateB - dateA;
  });
}

export async function getNotifications(): Promise<ShopXNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return sortNotifications(parsed);
  } catch (error) {
    console.log("ERROR GET NOTIFICATIONS:", error);
    return [];
  }
}

export async function getUnreadNotificationsCount() {
  try {
    const notifications = await getNotifications();

    return notifications.filter((notification) => !notification.read).length;
  } catch (error) {
    console.log("ERROR GET UNREAD NOTIFICATIONS COUNT:", error);
    return 0;
  }
}

export async function addNotification(
  notification: Omit<ShopXNotification, "id" | "createdAt" | "read">
) {
  try {
    const currentNotifications = await getNotifications();

    const nextNotification: ShopXNotification = {
      id: createNotificationId(),
      createdAt: new Date().toISOString(),
      read: false,
      priority: notification.priority || "normal",
      ...notification,
    };

    const nextNotifications = sortNotifications([
      nextNotification,
      ...currentNotifications,
    ]);

    await AsyncStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(nextNotifications)
    );

    notifyNotificationsChanged();

    return nextNotification;
  } catch (error) {
    console.log("ERROR ADD NOTIFICATION:", error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const notifications = await getNotifications();

    const nextNotifications = notifications.map((notification) =>
      notification.id === notificationId
        ? {
            ...notification,
            read: true,
          }
        : notification
    );

    await AsyncStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(nextNotifications)
    );

    notifyNotificationsChanged();

    return nextNotifications;
  } catch (error) {
    console.log("ERROR MARK NOTIFICATION READ:", error);
    return [];
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const notifications = await getNotifications();

    const nextNotifications = notifications.map((notification) => ({
      ...notification,
      read: true,
    }));

    await AsyncStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(nextNotifications)
    );

    notifyNotificationsChanged();

    return nextNotifications;
  } catch (error) {
    console.log("ERROR MARK ALL NOTIFICATIONS READ:", error);
    return [];
  }
}

export async function deleteNotification(notificationId: string) {
  try {
    const notifications = await getNotifications();

    const nextNotifications = notifications.filter(
      (notification) => notification.id !== notificationId
    );

    await AsyncStorage.setItem(
      NOTIFICATIONS_KEY,
      JSON.stringify(nextNotifications)
    );

    notifyNotificationsChanged();

    return nextNotifications;
  } catch (error) {
    console.log("ERROR DELETE NOTIFICATION:", error);
    return [];
  }
}

export async function clearNotifications() {
  await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
  notifyNotificationsChanged();
}

export async function seedDemoNotificationsIfEmpty() {
  const existingNotifications = await getNotifications();

  if (existingNotifications.length > 0) return existingNotifications;

  const demoNotifications: ShopXNotification[] = [
    {
      id: createNotificationId(),
      type: "promo",
      title: "Promo ShopX",
      message: "Tecnología seleccionada con precio final especial esta semana.",
      createdAt: new Date().toISOString(),
      read: false,
      priority: "high",
      actionLabel: "Ver productos",
      actionRoute: "/categories",
      metadata: {
        campaign: "tech_week",
      },
    },
    {
      id: createNotificationId(),
      type: "general",
      title: "Bienvenido a ShopX",
      message:
        "Ahora podés guardar favoritos, armar tu carrito y comprar productos de USA con precio final.",
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      read: false,
      priority: "normal",
      actionLabel: "Explorar",
      actionRoute: "/categories",
    },
    {
      id: createNotificationId(),
      type: "cart",
      title: "Tu carrito te espera",
      message:
        "Si agregaste productos al carrito, podés retomarlos cuando quieras.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      read: true,
      priority: "normal",
      actionLabel: "Ir al carrito",
      actionRoute: "/cart",
    },
  ];

  await AsyncStorage.setItem(
    NOTIFICATIONS_KEY,
    JSON.stringify(sortNotifications(demoNotifications))
  );

  notifyNotificationsChanged();

  return demoNotifications;
}