import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as eventsRepo from "@/db/repositories/events";
import { reportError } from "@/lib/error-reporting";
import type { ParsedEvent } from "@/lib/ical-parser";
import { toSourceEvents } from "@/lib/schedule-source";
import {
  cancelEventReminder,
  scheduleEventReminder,
} from "@/services/notifications";

export interface ImportInput {
  parsedEvents: ParsedEvent[];
  conventionId: string;
  sourceSnapshot: eventsRepo.SourceSnapshot;
}

export interface ImportResult {
  added: number;
  updated: number;
  unresolved: number;
  removed: number;
  /**
   * Saved events the feed stopped publishing. They are still on the schedule,
   * marked, so this is a count of things to look at rather than things lost.
   */
  tombstoned: number;
  /** Reminders whose moment has passed; the saved choice went with it. */
  remindersCleared: number;
  /**
   * Reminders the user still wants that the OS is not holding a request for,
   * because permission is missing or the notification store refused it.
   */
  remindersPaused: number;
}

/** The columns `rearmImportedReminders` needs off a stored row. */
export interface ImportedReminderEvent {
  id: string;
  conventionId: string;
  title: string;
  startTime: string;
  room: string | null;
  location: string | null;
  reminderMinutes: number | null;
}

export interface ReminderRearmResult {
  rescheduled: number;
  cleared: number;
  paused: number;
}

/**
 * Re-files the OS request for every reminder that survived a re-import.
 *
 * `reminderMinutes` is the user's intent, not a cache of the OS request, so a
 * request that cannot be filed leaves the column alone and is counted as
 * paused. Only a reminder whose moment has already passed is genuinely spent,
 * and only that clears the column. The previous version cleared it whenever
 * `scheduleEventReminder` returned null or threw, which destroyed the setting
 * for a transient failure and put the row beyond the reach of
 * `reconcileEventReminders`, since that only walks rows that still have one.
 */
export async function rearmImportedReminders(
  events: readonly ImportedReminderEvent[],
  now: number = Date.now(),
): Promise<ReminderRearmResult> {
  let rescheduled = 0;
  let cleared = 0;
  let paused = 0;

  for (const event of events) {
    const minutes = event.reminderMinutes;
    if (minutes === null) continue;

    const triggerMs = new Date(event.startTime).getTime() - minutes * 60 * 1000;
    if (Number.isFinite(triggerMs) && triggerMs <= now) {
      await cancelEventReminder(event.id);
      await eventsRepo.update(event.id, { reminderMinutes: null });
      cleared++;
      continue;
    }

    let notificationId: string | null = null;
    try {
      notificationId = await scheduleEventReminder(
        {
          id: event.id,
          conventionId: event.conventionId,
          title: event.title,
          startTime: event.startTime,
          room: event.room ?? event.location,
        },
        minutes,
        { requestPermission: false },
      );
    } catch (error) {
      reportError(error, { scope: "schedule-import.reminder-reschedule" });
    }

    if (notificationId) {
      rescheduled++;
    } else {
      paused++;
    }
  }

  return { rescheduled, cleared, paused };
}

export function useImportSchedule() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, ImportInput>({
    mutationFn: async ({ parsedEvents, conventionId, sourceSnapshot }) => {
      const mapped = toSourceEvents(parsedEvents, conventionId);

      const result = await eventsRepo.upsertBySourceUid(
        mapped,
        conventionId,
        sourceSnapshot,
      );

      let reminders: ReminderRearmResult = {
        rescheduled: 0,
        cleared: 0,
        paused: 0,
      };
      try {
        // Tombstoned events keep `reminderMinutes` — that column records what
        // the user asked for, and they have not changed their mind. What must
        // not survive is the OS request, or the phone would announce a panel
        // the convention is no longer running.
        await Promise.all(
          [...result.removedEventIds, ...result.tombstonedEventIds].map(
            (eventId) => cancelEventReminder(eventId),
          ),
        );
        const importedUids = new Set(mapped.map((event) => event.sourceUid));
        const importedEvents = (
          await eventsRepo.getByConventionId(conventionId)
        ).filter(
          (event) => event.sourceUid && importedUids.has(event.sourceUid),
        );

        reminders = await rearmImportedReminders(importedEvents);
      } catch (error) {
        // SQLite already committed. Every reminder keeps its saved choice, so
        // the next launch's reconciliation re-files whatever is missing.
        reportError(error, { scope: "schedule-import.reminders" });
      }

      return {
        added: result.added,
        updated: result.updated,
        removed: result.removedEventIds.length,
        tombstoned: result.tombstonedEventIds.length,
        unresolved: result.unresolvedSeries.length,
        remindersCleared: reminders.cleared,
        remindersPaused: reminders.paused,
      };
    },
    onSuccess: (_data, { conventionId }) => {
      queryClient.invalidateQueries({ queryKey: ["events", conventionId] });
    },
  });
}
