import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as eventsRepo from "@/db/repositories/events";
import type { ParsedEvent } from "@/lib/ical-parser";
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
}

export function useImportSchedule() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, ImportInput>({
    mutationFn: async ({ parsedEvents, conventionId, sourceSnapshot }) => {
      const mapped = parsedEvents.map((e) => ({
        conventionId,
        title: e.title,
        description: e.description,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime?.toISOString() ?? null,
        location: e.location,
        room: e.room,
        category: e.category,
        type: null,
        isInSchedule: false,
        reminderMinutes: null,
        sourceUid: e.sourceUid,
        legacySourceUid: e.legacySourceUid,
        sourceUrl: e.sourceUrl,
        isAgeRestricted: e.isAgeRestricted,
        ageRating: e.ageRating,
        contentWarning: e.contentWarning,
      }));

      const result = await eventsRepo.upsertBySourceUid(
        mapped,
        conventionId,
        sourceSnapshot,
      );
      try {
        await Promise.all(
          result.removedEventIds.map((eventId) => cancelEventReminder(eventId)),
        );
        const importedUids = new Set(mapped.map((event) => event.sourceUid));
        const importedEvents = (
          await eventsRepo.getByConventionId(conventionId)
        ).filter(
          (event) => event.sourceUid && importedUids.has(event.sourceUid),
        );

        for (const event of importedEvents) {
          if (event.reminderMinutes === null) continue;
          let notificationId: string | null = null;
          try {
            notificationId = await scheduleEventReminder(
              {
                id: event.id,
                title: event.title,
                startTime: event.startTime,
                room: event.room ?? event.location,
              },
              event.reminderMinutes,
              { requestPermission: false },
            );
          } catch {
            // The imported event stays; only the stale reminder is cleared.
          }
          if (!notificationId) {
            await eventsRepo.update(event.id, { reminderMinutes: null });
          }
        }
      } catch {
        // SQLite already committed. Startup reconciliation repairs any
        // notification work that could not finish during this import.
      }

      return {
        added: result.added,
        updated: result.updated,
        removed: result.removedEventIds.length,
        unresolved: result.unresolvedSeries.length,
      };
    },
    onSuccess: (_data, { conventionId }) => {
      queryClient.invalidateQueries({ queryKey: ["events", conventionId] });
    },
  });
}
