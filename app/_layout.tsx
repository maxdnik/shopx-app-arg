import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  handleInitialPushNotificationRoute,
  setupPushNotifications,
} from "../lib/push-notifications";

export default function RootLayout() {
  useEffect(() => {
    let removePushListeners: (() => void) | undefined;

    async function initializePushNotifications() {
      try {
        const result = await setupPushNotifications();

        removePushListeners = result.removeListeners;

        await handleInitialPushNotificationRoute();
      } catch (error) {
        console.log("ERROR SETUP PUSH NOTIFICATIONS:", error);
      }
    }

    initializePushNotifications();

    return () => {
      if (removePushListeners) {
        removePushListeners();
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </GestureHandlerRootView>
  );
}
