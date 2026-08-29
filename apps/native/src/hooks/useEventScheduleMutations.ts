import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Alert, Linking } from "react-native";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { hapticToggle } from "@/services/haptics";
import {
  cancelEventReminder,
  getNotificationPermissionStatus,
  scheduleEventReminder,
} from "@/services/notifications";

/** Why a reminder could not be set, so each cause gets its own message. */
type ReminderFailure =
  | "permission"
  | "permission-declined"
  | "too-late"
  | "cancel-failed"
  | "unknown";

class ReminderError extends Error {
  readonly failure: ReminderFailure;

  constructor(failure: ReminderFailure) {
    super(failure);
    this.failure = failure;
  }
}

/** Resolves true when the user wants to continue to the OS dialog. */
function confirmNotificationPriming(
  t: (key: string) => string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(t("reminders.priming.title"), t("reminders.priming.message"), [
      {
        text: t("reminders.priming.notNow"),
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: t("reminders.priming.continue"),
        onPress: () => resolve(true),
      },
    ]);
  });
}

interface Options {
  conventionId: string | undefined;
  /**
   * Fired when a reminder fails for lack of notification permission, so the
   * owning screen can flip its own permission state (and banner) without
   * waiting for the next focus re-read.
   */
  onPermissionDenied?: () => void;
}

/**
 * The star toggle and the reminder mutation, shared between the convention
 * detail screen (tap and swipe) and the event sheet route. Extracted from the
 * detail screen so the sheet — now a pushed formSheet route rather than a
 * Modal inside the screen — keeps the exact semantics: unstarring cancels the
 * event's reminder, a failed reminder change restores the previous one, and
 * haptics/announcements fire from onSuccess only (so a swipe and a sheet tap
 * cannot double-fire them).
 */
export function useEventScheduleMutations({
  conventionId,
  onPermissionDenied,
}: Options) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const toggleScheduleMutation = useMutation({
    mutationFn: async (event: ConventionEvent) => {
      const isInSchedule = !event.isInSchedule;
      if (isInSchedule || event.reminderMinutes === null) {
        await eventsRepo.update(event.id, { isInSchedule });
        return;
      }

      // An event taken off the schedule keeps no reminder: leaving one armed
      // fires a "time to leave" notification for a panel the user has already
      // dropped, and the row no longer shows a badge that would explain it.
      await cancelEventReminder(event.id);
      await eventsRepo.update(event.id, {
        isInSchedule,
        reminderMinutes: null,
      });
    },
    onSuccess: (_, event) => {
      queryClient.invalidateQueries({ queryKey: ["events", conventionId] });
      // `isInSchedule` is the state before the toggle, so the new state is its negation.
      hapticToggle(!event.isInSchedule);
      AccessibilityInfo.announceForAccessibility(
        t(
          event.isInSchedule
            ? "convention.scheduleRemovedAnnouncement"
            : "convention.scheduleAddedAnnouncement",
          { event: event.title },
        ),
      );
    },
    onError: () => {
      Alert.alert(
        t("convention.scheduleUpdateErrorTitle"),
        t("convention.scheduleUpdateErrorMessage"),
      );
    },
  });

  const setReminderMutation = useMutation({
    mutationFn: async ({
      event,
      minutes,
    }: {
      event: ConventionEvent;
      minutes: number | null;
    }) => {
      const reminderEvent = {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        room: event.room ?? event.location,
        // Without this the notification payload carries conventionId: null and
        // tapping the reminder navigates nowhere until the next foreground
        // reconciliation rewrites it. The reconciler was the only thing setting
        // it, which made fresh reminders silently un-tappable.
        conventionId: event.conventionId,
      };

      /**
       * `scheduleEventReminder` drops the request the OS is already holding
       * before it tries the new one, so a rejected change leaves the reminder
       * the user still has saved with nothing behind it. Putting it back is
       * what keeps the row and the OS agreeing.
       */
      async function restorePreviousReminder() {
        if (event.reminderMinutes === null) return;
        try {
          await scheduleEventReminder(reminderEvent, event.reminderMinutes, {
            requestPermission: false,
          });
        } catch {
          // Best effort: the next launch reconciles what is left.
        }
      }

      if (minutes !== null && event.startTime) {
        // Pre-prompt before the FIRST OS permission dialog, so the system
        // sheet arrives with context instead of out of nowhere. iOS only ever
        // shows its dialog once; declining the pre-prompt costs nothing and
        // the user can try again from the same picker.
        if ((await getNotificationPermissionStatus()) === "undetermined") {
          const proceed = await confirmNotificationPriming(t);
          if (!proceed) throw new ReminderError("permission-declined");
        }

        let notificationId: string | null = null;
        try {
          notificationId = await scheduleEventReminder(reminderEvent, minutes, {
            notificationContent: {
              title: t("reminders.notificationTitle", { event: event.title }),
              body: t(
                reminderEvent.room
                  ? "reminders.notificationBodyWithRoom"
                  : "reminders.notificationBody",
                { minutes, room: reminderEvent.room },
              ),
            },
          });
        } catch {
          // `reminderMinutes` is the only record that the user ever asked for
          // a reminder. A failed attempt at a new lead time must not wipe the
          // one they already had, so the row is left exactly as it was.
          await restorePreviousReminder();
          throw new ReminderError("unknown");
        }
        if (!notificationId) {
          // Two very different causes, and the OS reports both the same way.
          const permission = await getNotificationPermissionStatus();
          if (permission === "granted") await restorePreviousReminder();
          throw new ReminderError(
            permission === "granted" ? "too-late" : "permission",
          );
        }

        try {
          await eventsRepo.update(event.id, { reminderMinutes: minutes });
        } catch (error) {
          await cancelEventReminder(event.id);
          await restorePreviousReminder();
          throw error;
        }
      } else {
        if (!(await cancelEventReminder(event.id))) {
          throw new ReminderError("cancel-failed");
        }
        try {
          await eventsRepo.update(event.id, { reminderMinutes: null });
        } catch (error) {
          await restorePreviousReminder();
          throw error;
        }
      }
    },
    onSuccess: (_, { event, minutes }) => {
      queryClient.invalidateQueries({ queryKey: ["events", conventionId] });
      AccessibilityInfo.announceForAccessibility(
        t(
          minutes === null
            ? "reminders.clearedAnnouncement"
            : "reminders.setAnnouncement",
          { event: event.title, minutes },
        ),
      );
    },
    onError: (error) => {
      const failure =
        error instanceof ReminderError ? error.failure : "unknown";

      // The user answered "Not now" to the pre-prompt — that is a choice,
      // not an error, so no alert.
      if (failure === "permission-declined") return;

      if (failure === "permission") {
        onPermissionDenied?.();
        Alert.alert(
          t("reminders.permissionTitle"),
          t("reminders.permissionMessage"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("reminders.openSettings"),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return;
      }

      Alert.alert(
        t(
          failure === "too-late"
            ? "reminders.tooLateTitle"
            : "reminders.errorTitle",
        ),
        t(
          failure === "too-late"
            ? "reminders.tooLateMessage"
            : "reminders.errorMessage",
        ),
      );
    },
  });

  return { toggleScheduleMutation, setReminderMutation };
}
