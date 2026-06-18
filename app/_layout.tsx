import * as WebBrowser from "expo-web-browser";
import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  handleInitialPushNotificationRoute,
  setupPushNotifications,
} from "../lib/push-notifications";

WebBrowser.maybeCompleteAuthSession();

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
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}