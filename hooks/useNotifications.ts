import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  seedDemoNotificationsIfEmpty,
  ShopXNotification,
  subscribeToNotificationsChanges,
} from "../lib/notifications-store";
import {
  fetchAppNotifications,
  markAllAppNotificationsAsRead,
  markAppNotificationAsRead,
} from "../lib/notifications-api";

type UseNotificationsOptions = {
  seedDemo?: boolean;
  preferBackend?: boolean;
};

export function useNotifications(options?: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<ShopXNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [usingBackend, setUsingBackend] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");

  const refreshLocalNotifications = useCallback(async () => {
    const shouldSeedDemo = options?.seedDemo !== false;

    if (shouldSeedDemo) {
      await seedDemoNotificationsIfEmpty();
    }

    const [items, unread] = await Promise.all([
      getNotifications(),
      getUnreadNotificationsCount(),
    ]);

    setNotifications(items);
    setUnreadCount(unread);
    setUsingBackend(false);

    return {
      notifications: items,
      unreadCount: unread,
    };
  }, [options?.seedDemo]);

  const refreshNotifications = useCallback(async () => {
    setNotificationsError("");

    try {
      const shouldPreferBackend = options?.preferBackend !== false;

      if (shouldPreferBackend) {
        try {
          const backendResult = await fetchAppNotifications();

          setNotifications(backendResult.notifications);
          setUnreadCount(backendResult.unreadCount);
          setUsingBackend(true);
          setLoadingNotifications(false);

          return;
        } catch (backendError: any) {
          console.log("BACKEND NOTIFICATIONS FALLBACK:", backendError?.message);

          setNotificationsError(
            backendError?.message ||
              "No pudimos obtener las notificaciones online."
          );
        }
      }

      await refreshLocalNotifications();
    } catch (error) {
      console.log("ERROR REFRESH NOTIFICATIONS:", error);
      setNotifications([]);
      setUnreadCount(0);
      setUsingBackend(false);
    } finally {
      setLoadingNotifications(false);
    }
  }, [options?.preferBackend, refreshLocalNotifications]);

  useEffect(() => {
    refreshNotifications();

    const unsubscribe = subscribeToNotificationsChanges(() => {
      if (!usingBackend) {
        refreshNotifications();
      }
    });

    return unsubscribe;
  }, [refreshNotifications, usingBackend]);

  useFocusEffect(
    useCallback(() => {
      refreshNotifications();
    }, [refreshNotifications])
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        if (usingBackend) {
          await markAppNotificationAsRead(notificationId);
        } else {
          await markNotificationAsRead(notificationId);
        }

        await refreshNotifications();
      } catch (error) {
        console.log("ERROR MARK NOTIFICATION AS READ HOOK:", error);

        try {
          await markNotificationAsRead(notificationId);
          await refreshLocalNotifications();
        } catch (localError) {
          console.log("ERROR LOCAL MARK NOTIFICATION AS READ:", localError);
        }
      }
    },
    [refreshNotifications, refreshLocalNotifications, usingBackend]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      if (usingBackend) {
        await markAllAppNotificationsAsRead();
      } else {
        await markAllNotificationsAsRead();
      }

      await refreshNotifications();
    } catch (error) {
      console.log("ERROR MARK ALL NOTIFICATIONS AS READ HOOK:", error);

      try {
        await markAllNotificationsAsRead();
        await refreshLocalNotifications();
      } catch (localError) {
        console.log("ERROR LOCAL MARK ALL NOTIFICATIONS AS READ:", localError);
      }
    }
  }, [refreshNotifications, refreshLocalNotifications, usingBackend]);

  return {
    notifications,
    unreadCount,
    loadingNotifications,
    notificationsError,
    usingBackend,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  };
}

export function useUnreadNotificationsCount(options?: UseNotificationsOptions) {
  const {
    unreadCount,
    loadingNotifications,
    notificationsError,
    usingBackend,
    refreshNotifications,
  } = useNotifications(options);

  return {
    unreadCount,
    loadingNotifications,
    notificationsError,
    usingBackend,
    refreshUnreadCount: refreshNotifications,
  };
}