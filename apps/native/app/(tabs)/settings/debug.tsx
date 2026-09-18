import { FieldGroup, Host, Button as NativeButton } from "@expo/ui";
import { useQueryClient } from "@tanstack/react-query";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, Platform } from "react-native";
// See components/ui/FieldRow.android.tsx — one Material surface per row.
import { FieldRow as ListItem } from "@/components/ui/FieldRow";
import { NativeText } from "@/components/ui/NativeText";
import {
  BLANK_PREVIEW_CONVENTION_ID,
  PREVIEW_CONVENTION_ID,
} from "@/fixtures/conpaws-preview";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import {
  type ConventionPreviewState,
  developerToolsEnabled,
} from "@/lib/developer-tools";
import { resetOnboarding } from "@/lib/onboarding-storage";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import { resetPreviewConventions } from "@/lib/preview-convention";
import {
  getHapticsEnabled,
  hapticLongPress,
  hapticSuccess,
  hapticTap,
  hapticToggle,
} from "@/services/haptics";
import {
  endLiveActivity,
  startOrUpdateLiveActivity,
} from "@/services/live-activity";
import {
  cancelTestNotifications,
  getNotificationPermissionStatus,
  type PermissionStatus,
  requestNotificationPermission,
  scheduleTestNotification,
} from "@/services/notifications";
import {
  publishWidgetSnapshotValue,
  type WidgetSnapshot,
} from "@/services/widget-snapshot";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function buildPlanSurfacePreview(nowMs = Date.now()): WidgetSnapshot {
  const currentMinute = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  const timeZoneIdentifier =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return {
    schemaVersion: 3,
    generatedAtMs: currentMinute,
    localeIdentifier: "en",
    conventions: [
      {
        id: PREVIEW_CONVENTION_ID,
        name: "ConPaws Surface Preview",
        startAtMs: currentMinute - DAY_MS,
        endAtMs: currentMinute + DAY_MS,
        timeZoneIdentifier,
        dateRangeLabel: "Developer preview · today",
        events: [
          {
            id: "conpaws-preview-event-1",
            title: "Fursuit photography",
            startAtMs: currentMinute - 45 * MINUTE_MS,
            endAtMs: currentMinute + 30 * MINUTE_MS,
            attendanceStartAtMs: currentMinute - 18 * MINUTE_MS,
            attendanceEndAtMs: currentMinute + 7 * MINUTE_MS,
            attendanceNeedsReview: false,
            location: "Convention Center",
            room: "Ballroom A",
            reminderMinutes: null,
            ageRating: null,
          },
          {
            id: "conpaws-preview-event-2",
            title: "Character design lab",
            startAtMs: currentMinute - 5 * MINUTE_MS,
            endAtMs: currentMinute + 85 * MINUTE_MS,
            attendanceStartAtMs: currentMinute + 17 * MINUTE_MS,
            attendanceEndAtMs: currentMinute + 62 * MINUTE_MS,
            attendanceNeedsReview: false,
            location: "Convention Center",
            room: "Cedar",
            reminderMinutes: null,
            ageRating: null,
          },
        ],
      },
    ],
  };
}

export default function DebugScreen() {
  const queryClient = useQueryClient();
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [notificationAction, setNotificationAction] = useState<
    "send" | "clear" | null
  >(null);
  const [notificationPermission, setNotificationPermission] =
    useState<PermissionStatus>("undetermined");
  const [surfaceAction, setSurfaceAction] = useState<
    "publish" | "start" | "stop" | null
  >(null);
  const presentationLock = useRef(0);
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();
  const appVariant = Constants.expoConfig?.extra?.appVariant;
  const enabled = developerToolsEnabled(__DEV__, appVariant);
  const version =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    "Unknown";
  const buildNumber = Application.nativeBuildVersion ?? "Development";
  // ponytail: read at render rather than subscribe -- this screen is pushed
  // fresh each time, so it cannot go stale behind a Settings toggle.
  const hapticsEnabled = getHapticsEnabled();
  const variantName =
    appVariant === "preview"
      ? "Preview"
      : appVariant === "production"
        ? "Production"
        : "Development";

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
            await resetOnboarding();
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

  async function runSurfaceAction(action: "publish" | "start" | "stop") {
    if (surfaceAction !== null) return;
    setSurfaceAction(action);
    try {
      if (action === "stop") {
        const status = await endLiveActivity(false);
        Alert.alert(
          "Plan surface stopped",
          status.availability === "unsupported"
            ? "This native build does not include the plan surface module."
            : "The Live Activity or Android plan notification was removed.",
        );
        return;
      }

      const snapshot = buildPlanSurfacePreview();
      if (action === "publish") {
        const published = await publishWidgetSnapshotValue(snapshot);
        Alert.alert(
          published ? "Preview published" : "Preview unavailable",
          published
            ? "Widget, Watch, and complication timelines received a current panel, a seven-minute leave cue, and a late-join next panel."
            : "This native build does not include the widget snapshot module.",
        );
        return;
      }

      if (Platform.OS === "android") {
        const permission = await requestNotificationPermission();
        setNotificationPermission(permission);
        if (permission !== "granted") {
          Alert.alert(
            "Notifications are off",
            "Allow notifications in System Settings, then try again.",
          );
          return;
        }
      }
      const status = await startOrUpdateLiveActivity(
        snapshot,
        snapshot.generatedAtMs,
      );
      Alert.alert(
        status.active ? "Plan surface started" : "Plan surface unavailable",
        status.active
          ? Platform.OS === "android"
            ? "An ordinary ongoing notification now shows the current and next stops."
            : "The Live Activity now shows the current and next stops."
          : `Availability: ${status.availability}${status.reason ? ` · ${status.reason}` : ""}`,
      );
    } catch {
      Alert.alert(
        "Plan surface could not update",
        "The preview was not changed. Check this native build and try again.",
      );
    } finally {
      setSurfaceAction(null);
    }
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
          <ListItem supportingText={`${version} (${buildNumber})`}>
            {variantName} app version
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title="Haptics">
          <ListItem
            supportingText={
              hapticsEnabled
                ? "On. Each button fires one effect."
                : "Off in Settings, so every button below does nothing."
            }
          >
            Haptic feedback
          </ListItem>
          <NativeButton
            label="Success"
            onPress={hapticSuccess}
            testID="debug-haptic-success"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Toggle On"
            variant="outlined"
            onPress={() => hapticToggle(true)}
            testID="debug-haptic-toggle-on"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Toggle Off"
            variant="outlined"
            onPress={() => hapticToggle(false)}
            testID="debug-haptic-toggle-off"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Long Press"
            variant="outlined"
            onPress={hapticLongPress}
            testID="debug-haptic-long-press"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Tap (iOS only)"
            variant="text"
            onPress={hapticTap}
            testID="debug-haptic-tap"
            style={{ height: 44 }}
          />
          <FieldGroup.SectionFooter>
            <NativeText textStyle={{ fontSize: 13 }}>
              Tap does nothing on Android on purpose — Material 3 gives plain
              presses a ripple instead. If a button feels like nothing on a
              device you expect to buzz, check what the system actually did: adb
              shell dumpsys vibrator_manager | grep conpaws. "finished …
              played:" ran the motor; "ignored_unsupported … played: null" was
              dropped by the device.
            </NativeText>
          </FieldGroup.SectionFooter>
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

        <FieldGroup.Section
          title="Plan surfaces"
          disabled={surfaceAction !== null}
        >
          <ListItem supportingText="Uses a now-relative current stop, a leave cue in seven minutes, and a next stop with a planned late join. This does not change the saved phone plan.">
            Native surface preview
          </ListItem>
          <NativeButton
            label={
              surfaceAction === "publish"
                ? "Publishing Preview"
                : "Preview Widget & Watch"
            }
            onPress={() => void runSurfaceAction("publish")}
            disabled={surfaceAction !== null}
            testID="debug-preview-widget-watch"
            style={{ height: 44 }}
          />
          <NativeButton
            label={
              surfaceAction === "start"
                ? "Starting Plan Surface"
                : Platform.OS === "android"
                  ? "Preview Ongoing Notification"
                  : "Preview Live Activity"
            }
            variant="outlined"
            onPress={() => void runSurfaceAction("start")}
            disabled={surfaceAction !== null}
            testID="debug-preview-plan-surface"
            style={{ height: 44 }}
          />
          <NativeButton
            label={
              surfaceAction === "stop"
                ? "Stopping Plan Surface"
                : "Stop Plan Surface"
            }
            variant="text"
            onPress={() => void runSurfaceAction("stop")}
            disabled={surfaceAction !== null}
            testID="debug-stop-plan-surface"
            style={{ height: 44 }}
          />
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
                : "Preview Busy Schedule"
            }
            onPress={() =>
              void loadPreviewConvention(PREVIEW_CONVENTION_ID, "content")
            }
            disabled={isLoadingPreview}
            testID="debug-load-preview-con"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Preview My Plan"
            onPress={() =>
              void loadPreviewConvention(PREVIEW_CONVENTION_ID, "plan")
            }
            variant="outlined"
            disabled={isLoadingPreview}
            testID="debug-preview-plan"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Preview Interested"
            onPress={() =>
              void loadPreviewConvention(PREVIEW_CONVENTION_ID, "interested")
            }
            variant="outlined"
            disabled={isLoadingPreview}
            testID="debug-preview-interested"
            style={{ height: 44 }}
          />
          <NativeButton
            label="Preview Now & Next"
            onPress={() =>
              void loadPreviewConvention(PREVIEW_CONVENTION_ID, "now-next")
            }
            variant="outlined"
            disabled={isLoadingPreview}
            testID="debug-preview-now-next"
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
