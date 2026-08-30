import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState } from "react-native";
import type { Convention } from "@/db/schema";
import { reportError } from "@/lib/error-reporting";
import {
  hasSavedChanges,
  type ScheduleChangeSummary,
} from "@/lib/schedule-changes";
import { hapticSuccess } from "@/services/haptics";
import { refreshConventionSchedule } from "@/services/schedule-refresh";

export interface ScheduleRefreshState {
  /** Set only when something the user saved moved or went. */
  summary: ScheduleChangeSummary | null;
  /** When the feed was last read successfully. Null until one succeeds. */
  checkedAt: number | null;
  /** True only for a check the user pressed for; the quiet one shows nothing. */
  checking: boolean;
  /** Null unless an explicit check failed and the user is owed an answer. */
  failed: boolean;
  checkNow: () => void;
  dismiss: () => void;
}

/**
 * Re-reads a convention's feed when the screen comes into view.
 *
 * On focus and on return from the background, matching
 * `useNotificationPermission` — the two moments the user has just chosen to
 * look at this convention. Not on a timer: the home list learned the hard way
 * that a value changing under a list rebuilds the tree and cancels whatever
 * gesture was in flight, and a schedule reordering under a thumb is worse.
 *
 * Everything that decides whether a check may run, and whether its result can
 * be trusted, lives in `refreshConventionSchedule`. This hook only decides what
 * the screen is allowed to say about it.
 */
export function useScheduleRefresh(
  convention: Convention | undefined,
): ScheduleRefreshState {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ScheduleChangeSummary | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);

  const run = useCallback(
    async (force: boolean) => {
      if (!convention) return;
      // A second check while one is in flight would double-apply the same feed.
      if (running.current) return;
      running.current = true;
      if (force) {
        setChecking(true);
        setFailed(false);
      }

      // `running` is cleared in the `finally`, never on the happy path alone.
      // `refreshConventionSchedule` catches its own failures, but the reads it
      // does before that -- the checked-at stamp, the saved categories -- sit
      // outside it. A throw there used to leave this guard stuck true, which
      // silently dropped every later check, automatic and pressed alike, until
      // the app was relaunched, with nothing shown and nothing reported.
      try {
        const result = await refreshConventionSchedule(
          convention,
          {
            refreshCaches: (conventionId) =>
              Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: ["conventions"] }),
                queryClient.invalidateQueries({
                  queryKey: ["convention", conventionId],
                }),
                queryClient.invalidateQueries({
                  queryKey: ["events", conventionId],
                }),
              ]),
          },
          { force },
        );

        if (!mounted.current) return;
        setChecking(false);

        if (result.status === "applied") {
          setCheckedAt(result.checkedAt);
          // Only saved events are worth a notice. A feed that shuffled forty
          // panels the user never starred produces no UI at all.
          setSummary(hasSavedChanges(result.summary) ? result.summary : null);
          return;
        }
        if (result.status === "unchanged") {
          setCheckedAt(result.checkedAt);
          setSummary(null);
          // A press deserves an answer. The timestamp in the caption moving is
          // that answer, so this only confirms it landed — an alert saying
          // "nothing happened" is the interruption this whole design avoids.
          if (force) hapticSuccess();
          return;
        }
        // `untrusted` and `skipped` leave the screen exactly as it was, always.
        // A failure is admitted only when the user pressed for the check: an
        // unbidden "couldn't reach the schedule" on convention wifi reads as an
        // accusation, and there is nothing the reader can do about it anyway.
        if (result.status === "failed" && force) {
          setFailed(true);
          Alert.alert(
            t("convention.scheduleUpdate.checkFailedTitle"),
            t("convention.scheduleUpdate.checkFailedMessage"),
          );
        }
      } catch (error) {
        reportError(error, { scope: "schedule-refresh.run" });
        if (!mounted.current) return;
        setChecking(false);
        // Same restraint as a `failed` result: only a check the user asked for
        // gets to interrupt them about it.
        if (force) {
          setFailed(true);
          Alert.alert(
            t("convention.scheduleUpdate.checkFailedTitle"),
            t("convention.scheduleUpdate.checkFailedMessage"),
          );
        }
      } finally {
        running.current = false;
      }
    },
    [convention, queryClient, t],
  );

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      void run(false);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void run(false);
      });
      return () => {
        mounted.current = false;
        subscription.remove();
      };
    }, [run]),
  );

  return {
    summary,
    checkedAt,
    checking,
    failed,
    checkNow: useCallback(() => {
      void run(true);
    }, [run]),
    dismiss: useCallback(() => {
      setSummary(null);
    }, []),
  };
}
