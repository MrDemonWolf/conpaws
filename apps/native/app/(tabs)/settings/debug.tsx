import { FieldGroup, Host, ListItem, Button as NativeButton } from "@expo/ui";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, useColorScheme } from "react-native";
import {
  BLANK_PREVIEW_CONVENTION_ID,
  PREVIEW_CONVENTION_ID,
} from "@/fixtures/conpaws-preview";
import {
  type ConventionPreviewState,
  developerToolsEnabled,
} from "@/lib/developer-tools";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import { resetPreviewConventions } from "@/lib/preview-convention";
import {
  cancelTestNotifications,
  getNotificationPermissionStatus,
  type PermissionStatus,
  scheduleTestNotification,
} from "@/services/notifications";

export default function DebugScreen() {
  const queryClient = useQueryClient();
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [notificationAction, setNotificationAction] = useState<
    "send" | "clear" | null
  >(null);
  const [notificationPermission, setNotificationPermission] =
    useState<PermissionStatus>("undetermined");
  const presentationLock = useRef(false);
  const colorScheme = useColorScheme();
  const { colors } = useTheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";
  const appVariant = Constants.expoConfig?.extra?.appVariant;
  const enabled = developerToolsEnabled(__DEV__, appVariant);
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    "Development";

  useEffect(() => {
    function refreshPermission() {
      void getNotificationPermissionStatus()
        .then(setNotificationPermission)
        .catch(() => undefined);
    }

    refreshPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshPermission();
    });
    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
    }, []),
  );

  if (!enabled) return <Redirect href="/(tabs)/settings" />;

  function replayOnboarding() {
    Alert.alert(
      "Replay Onboarding?",
      "This only resets the onboarding flag. Your conventions and settings stay unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replay",
          onPress: async () => {
            await AsyncStorage.removeItem("hasCompletedOnboarding");
            router.replace("/(onboarding)/welcome");
          },
        },
      ],
    );
  }

  async function loadPreviewConvention(
    id: string,
    previewState: ConventionPreviewState,
  ) {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    setIsLoadingPreview(true);
    try {
      const installed = await resetPreviewConventions(__DEV__, appVariant);
      if (!installed) {
        resetPresentationLock(presentationLock);
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["conventions"] }),
          queryClient.invalidateQueries({ queryKey: ["convention"] }),
          queryClient.invalidateQueries({ queryKey: ["events"] }),
        ]);
        router.push({
          pathname: "/convention/[id]",
          params: previewState === "empty" ? { id } : { id, previewState },
        });
      }
    } catch {
      resetPresentationLock(presentationLock);
      Alert.alert(
        "Preview Con could not be loaded",
        "Your existing conventions were not changed. Try again.",
      );
    }
    setIsLoadingPreview(false);
  }

  function sendTestNotification() {
    setNotificationAction("send");
    void scheduleTestNotification()
      .then(async (identifier) => {
        const permission = await getNotificationPermissionStatus();
        setNotificationPermission(permission);
        Alert.alert(
          identifier ? "Test scheduled" : "Notifications are off",
          identifier
            ? "A local notification will arrive in about five seconds."
            : "Allow notifications in System Settings, then try again.",
        );
      })
      .catch(() => {
        Alert.alert(
          "Test notification failed",
          "No notification was scheduled. Try again.",
        );
      })
      .finally(() => setNotificationAction(null));
  }

  function clearTestNotifications() {
    setNotificationAction("clear");
    void cancelTestNotifications()
      .then((count) => {
        Alert.alert(
          "Test notifications cleared",
          count === 1
            ? "One pending test was removed."
            : `${count} pending tests were removed.`,
        );
      })
      .catch(() => {
        Alert.alert(
          "Could not clear tests",
          "The notification store is unavailable. Try again.",
        );
      })
      .finally(() => setNotificationAction(null));
  }

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section title="Build">
          <ListItem supportingText={String(appVariant ?? "Unknown")}>
            App variant
          </ListItem>
          <ListItem supportingText={buildNumber}>
            Version {Constants.expoConfig?.version ?? "Unknown"}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section
          title="Notifications"
          disabled={notificationAction !== null}
        >
          <ListItem
            supportingText={
              notificationPermission === "granted"
                ? "Allowed"
                : notificationPermission === "denied"
                  ? "Blocked in System Settings"
                  : "Not requested"
            }
          >
            Current permission
          </ListItem>
          <NativeButton
            label={
              notificationAction === "send"
                ? "Scheduling Test"
                : "Send Test in 5 Seconds"
            }
            onPress={sendTestNotification}
            disabled={notificationAction !== null}
            testID="debug-send-test-notification"
            style={{ height: 44 }}
          />
          <NativeButton
            label={
              notificationAction === "clear"
                ? "Clearing Tests"
                : "Clear Pending Tests"
            }
            variant="outlined"
            onPress={clearTestNotifications}
            disabled={notificationAction !== null}
            testID="debug-clear-test-notifications"
            style={{ height: 44 }}
          />
          {notificationPermission === "denied" ? (
            <NativeButton
              label="Open System Settings"
              variant="text"
              onPress={() => Linking.openSettings()}
              style={{ height: 44 }}
            />
          ) : null}
        </FieldGroup.Section>

        <FieldGroup.Section title="Onboarding">
          <ListItem supportingText="Your conventions and settings stay unchanged.">
            Replay the first-run experience
          </ListItem>
          <NativeButton
            label="Replay Onboarding"
            variant="outlined"
            onPress={replayOnboarding}
            style={{ height: 44 }}
          />
        </FieldGroup.Section>

        <FieldGroup.Section title="Preview data" disabled={isLoadingPreview}>
          <ListItem supportingText="Reset a full 200-event schedule and a blank convention for offline previews and tests.">
            ConPaws Preview Cons
          </ListItem>
          <NativeButton
            label={
              isLoadingPreview
                ? "Loading Preview Cons"
                : "Preview Content State"
            }
            onPress={() =>
              void loadPreviewConvention(PREVIEW_CONVENTION_ID, "content")
            }
            disabled={isLoadingPreview}
            testID="debug-load-preview-con"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Preview Empty State"
            onPress={() =>
              void loadPreviewConvention(BLANK_PREVIEW_CONVENTION_ID, "empty")
            }
            variant="outlined"
            disabled={isLoadingPreview}
            testID="debug-load-blank-preview-con"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Preview Loading State"
            onPress={() =>
              void loadPreviewConvention(PREVIEW_CONVENTION_ID, "loading")
            }
            variant="outlined"
            disabled={isLoadingPreview}
            testID="debug-preview-convention-loading"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Preview Error State"
            onPress={() =>
              void loadPreviewConvention(PREVIEW_CONVENTION_ID, "error")
            }
            variant="outlined"
            disabled={isLoadingPreview}
            testID="debug-preview-convention-error"
            style={{ height: 44 }}
          />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
