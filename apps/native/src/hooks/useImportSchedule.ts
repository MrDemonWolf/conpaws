import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as eventsRepo from "@/db/repositories/events";
import type { ParsedEvent } from "@/lib/ical-parser";
import { scheduleEventReminder } from "@/services/notifications";

export interface ImportInput {
  parsedEvents: ParsedEvent[];
  conventionId: string;
}

export interface ImportResult {
  added: number;
  updated: number;
}

export function useImportSchedule() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, ImportInput>({
    mutationFn: async ({ parsedEvents, conventionId }) => {
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
        sourceUrl: e.sourceUrl,
        isAgeRestricted: e.isAgeRestricted,
        contentWarning: e.contentWarning,
      }));

      const result = await eventsRepo.upsertBySourceUid(mapped, conventionId);
      const importedUids = new Set(mapped.map((event) => event.sourceUid));
      const importedEvents = (
        await eventsRepo.getByConventionId(conventionId)
      ).filter((event) => event.sourceUid && importedUids.has(event.sourceUid));

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
          );
        } catch {
          // The imported event stays; only the stale reminder is cleared.
        }
        if (!notificationId) {
          await eventsRepo.update(event.id, { reminderMinutes: null });
        }
      }

      return result;
    },
    onSuccess: (_data, { conventionId }) => {
      queryClient.invalidateQueries({ queryKey: ["events", conventionId] });
    },
  });
}
