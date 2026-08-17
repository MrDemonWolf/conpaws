import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as eventsRepo from "@/db/repositories/events";
import type { ParsedEvent } from "@/lib/ical-parser";

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

      return eventsRepo.upsertBySourceUid(mapped, conventionId);
    },
    onSuccess: (_data, { conventionId }) => {
      queryClient.invalidateQueries({ queryKey: ["events", conventionId] });
    },
  });
}
