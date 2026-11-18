import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Alert, Linking } from "react-native";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention, ConventionEvent } from "@/db/schema";
import { reportError } from "@/lib/error-reporting";
import { trackedEventBlocker } from "@/lib/tracked-event";
import type { TrackedEventSelection } from "@/lib/tracked-event.types";
import { hapticToggle } from "@/services/haptics";
import {
  getTrackedEventSelection,
  isTrackingSupported,
  startTrackingEvent,
  stopTrackingEvent,
  subscribeTrackedEvent,
} from "@/services/tracked-event";

// Module-level so useSyncExternalStore sees one stable subscribe function and
// does not resubscribe on every render. The change payload is ignored here:
// every surface re-reads the selection, and automatic endings stay silent.
function subscribe(onStoreChange: () => void): () => void {
  return subscribeTrackedEvent(() => onStoreChange());
}

/**
 * The tracked event's row lives under the convention's ["events", id] prefix
 * so every existing invalidation of that convention's events (star, reminder,
 * visit, import, refresh, preview reset) refreshes the banner's title, time
 * and room too, without each of those sites knowing tracking exists.
 */
function trackedEventQueryKey(selection: TrackedEventSelection) {
  return [
    "events",
    selection.conventionId,
    "tracked",
    selection.eventId,
  ] as const;
}

function confirmReplace(
  t: (key: string, options?: Record<string, unknown>) => string,
  current: string,
  next: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t("tracking.replace.title"),
      t("tracking.replace.message", { current, next }),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: t("tracking.replace.confirm"),
          onPress: () => resolve(true),
        },
      ],
      // Android lets the dialog be dismissed by tapping outside it; that is a
      // decline, and the promise must still settle.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function showPermissionAlert(
  title: string,
  message: string,
  t: (key: string) => string,
) {
  Alert.alert(title, message, [
    { text: t("common.cancel"), style: "cancel" },
    {
      text: t("reminders.openSettings"),
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

export interface TrackedEventDetails {
  event: ConventionEvent;
  convention: Convention;
}

/**
 * Track event for screens: which event is tracked, whether another can be,
 * and the start and stop actions with their prompts, haptics and
 * announcements.
 *
 * Feedback fires only for what the user did here. An event that ends, is
 * removed by the feed or is archived stops quietly, because nobody pressed
 * anything and a haptic out of nowhere reads as a fault.
 */
export function useTrackedEvent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const selection = useSyncExternalStore(
    subscribe,
    getTrackedEventSelection,
    getTrackedEventSelection,
  );
  const [busy, setBusy] = useState(false);
  // State alone lets a fast double tap through before the re-render lands.
  const inFlight = useRef(false);

  const { data: trackedEvent } = useQuery({
    queryKey: selection
      ? trackedEventQueryKey(selection)
      : ["events", "", "tracked", ""],
    queryFn: async () =>
      (await eventsRepo.getById(selection?.eventId ?? "")) ?? null,
    enabled: !!selection,
  });
  const { data: trackedConvention } = useQuery({
    queryKey: ["convention", selection?.conventionId ?? ""],
    queryFn: () => conventionsRepo.getById(selection?.conventionId ?? ""),
    enabled: !!selection,
  });

  const tracked: TrackedEventDetails | null =
    selection &&
    trackedEvent &&
    trackedConvention &&
    trackedEvent.id === selection.eventId &&
    trackedConvention.id === selection.conventionId
      ? { event: trackedEvent, convention: trackedConvention }
      : null;

  const titleOf = useCallback(
    async (current: TrackedEventSelection): Promise<string | null> => {
      try {
        const row = await queryClient.fetchQuery({
          queryKey: trackedEventQueryKey(current),
          queryFn: async () =>
            (await eventsRepo.getById(current.eventId)) ?? null,
        });
        return row?.title ?? null;
      } catch (error) {
        reportError(error, { scope: "trackedEvent.title" });
        return null;
      }
    },
    [queryClient],
  );

  const isTrackable = useCallback(
    (event: ConventionEvent | undefined, convention: Convention | undefined) =>
      isTrackingSupported() &&
      trackedEventBlocker(event, convention, Date.now()) === null,
    [],
  );

  const track = useCallback(
    async (event: ConventionEvent, convention: Convention) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const current = getTrackedEventSelection();
        if (current && current.eventId === event.id) return;
        if (current) {
          // A tracked event whose row is gone has nothing left to replace, so
          // there is nothing to ask about.
          const currentTitle = await titleOf(current);
          if (currentTitle !== null) {
            const proceed = await confirmReplace(t, currentTitle, event.title);
            // Declining is a choice, not an error: no alert, no haptic.
            if (!proceed) return;
          }
        }

        // Busy only covers the platform call, so the button does not spin
        // behind the replace prompt while the user is still deciding.
        setBusy(true);
        let result: Awaited<ReturnType<typeof startTrackingEvent>>;
        try {
          result = await startTrackingEvent(event.id, convention.id);
        } catch (error) {
          reportError(error, { scope: "trackedEvent.start" });
          result = { status: "failed" };
        }

        switch (result.status) {
          case "started":
            hapticToggle(true);
            AccessibilityInfo.announceForAccessibility(
              t("tracking.startedAnnouncement", { title: event.title }),
            );
            return;
          case "notifications-denied":
            showPermissionAlert(
              t("tracking.permission.notificationsTitle"),
              t("tracking.permission.notificationsMessage"),
              t,
            );
            return;
          case "live-activities-disabled":
            showPermissionAlert(
              t("tracking.permission.liveActivitiesTitle"),
              t("tracking.permission.liveActivitiesMessage"),
              t,
            );
            return;
          case "not-trackable":
            // The event ended, was cancelled or was unsaved while its sheet
            // stayed open. Trying again cannot work, so instead of an error
            // the screens re-read the row and stop offering Track.
            await queryClient.invalidateQueries({
              queryKey: ["events", convention.id],
            });
            return;
          default:
            Alert.alert(t("tracking.errorTitle"), t("tracking.errorMessage"));
        }
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [queryClient, t, titleOf],
  );

  const stop = useCallback(async () => {
    if (inFlight.current) return;
    const current = getTrackedEventSelection();
    if (!current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const title =
        (tracked?.event.id === current.eventId ? tracked.event.title : null) ??
        (await titleOf(current));
      await stopTrackingEvent();
      hapticToggle(false);
      if (title !== null) {
        AccessibilityInfo.announceForAccessibility(
          t("tracking.stoppedAnnouncement", { title }),
        );
      }
    } catch (error) {
      // The next reconcile (every foreground and every mutation) tries again,
      // and the banner keeps its Stop action while the selection stands, so
      // the user still has a way out. tracking.errorMessage is about starting,
      // so it would be the wrong sentence to show here.
      reportError(error, { scope: "trackedEvent.stop" });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [t, titleOf, tracked]);

  return {
    trackedEventId: selection?.eventId ?? null,
    trackedConventionId: selection?.conventionId ?? null,
    tracked,
    isTrackable,
    track,
    stop,
    busy,
  };
}
