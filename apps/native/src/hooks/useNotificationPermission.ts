import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState } from "react-native";
import {
  getNotificationPermissionStatus,
  type PermissionStatus,
} from "@/services/notifications";

/**
 * The OS notification-permission status, re-read on every focus and on every
 * return to the foreground — turning notifications back on happens in the OS
 * settings app, which does not re-mount the reading screen. Extracted from the
 * convention screen so the Schedule tab's reminder banner can share it.
 * `null` while the first read is in flight.
 */
export function useNotificationPermission(): PermissionStatus | null {
  const [permission, setPermission] = useState<PermissionStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      function readPermission() {
        void getNotificationPermissionStatus()
          .then((status) => {
            if (active) setPermission(status);
          })
          .catch(() => undefined);
      }

      readPermission();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") readPermission();
      });
      return () => {
        active = false;
        subscription.remove();
      };
    }, []),
  );

  return permission;
}
