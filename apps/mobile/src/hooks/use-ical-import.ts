import { useState, useCallback } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  parseICalContent,
  parsedEventsToNewEvents,
  type ParsedCalendar,
} from "@/lib/ical-parser";
import { fetchSchedIcs } from "@/lib/sched-url";
import { createConvention } from "@/db/repositories/conventions";
import { bulkCreateEvents, getEventBySourceUid } from "@/db/repositories/events";
import { useQueryClient } from "@tanstack/react-query";

interface ImportState {
  isLoading: boolean;
  error: string | null;
  parsedCalendar: ParsedCalendar | null;
}

export function useICalImport() {
  const [state, setState] = useState<ImportState>({
    isLoading: false,
    error: null,
    parsedCalendar: null,
  });
  const queryClient = useQueryClient();

  const pickAndParseFile = useCallback(async () => {
    setState({ isLoading: true, error: null, parsedCalendar: null });

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/calendar", "application/octet-stream"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setState({ isLoading: false, error: null, parsedCalendar: null });
        return null;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = parseICalContent(content);

      setState({ isLoading: false, error: null, parsedCalendar: parsed });
      return parsed;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to parse file";
      setState({ isLoading: false, error: message, parsedCalendar: null });
      return null;
    }
  }, []);

  const fetchAndParseUrl = useCallback(async (url: string) => {
    setState({ isLoading: true, error: null, parsedCalendar: null });

    try {
      const content = await fetchSchedIcs(url);
      const parsed = parseICalContent(content);

      setState({ isLoading: false, error: null, parsedCalendar: parsed });
      return parsed;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch schedule";
      setState({ isLoading: false, error: message, parsedCalendar: null });
      return null;
    }
  }, []);

  const importEvents = useCallback(
    async (
      calendar: ParsedCalendar,
      selectedIndices?: Set<number>,
      existingConventionId?: string,
    ) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        let conventionId = existingConventionId;

        if (!conventionId) {
          const convention = await createConvention({
            name: calendar.name,
            startDate: calendar.startDate,
            endDate: calendar.endDate,
            icalUrl: null,
          });
          conventionId = convention.id;
        }

        const eventsToImport = selectedIndices
          ? calendar.events.filter((_, i) => selectedIndices.has(i))
          : calendar.events;

        const newEvents = parsedEventsToNewEvents(
          conventionId,
          eventsToImport,
        );

        // Check for duplicates by sourceUid
        const eventsToCreate = [];
        for (const event of newEvents) {
          if (event.sourceUid) {
            const existing = await getEventBySourceUid(
              conventionId,
              event.sourceUid,
            );
            if (existing) continue;
          }
          eventsToCreate.push(event);
        }

        await bulkCreateEvents(eventsToCreate);

        queryClient.invalidateQueries({ queryKey: ["conventions"] });
        queryClient.invalidateQueries({
          queryKey: ["events", conventionId],
        });

        setState({ isLoading: false, error: null, parsedCalendar: null });
        return conventionId;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to import events";
        setState((s) => ({ ...s, isLoading: false, error: message }));
        return null;
      }
    },
    [queryClient],
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, parsedCalendar: null });
  }, []);

  return {
    ...state,
    pickAndParseFile,
    fetchAndParseUrl,
    importEvents,
    reset,
  };
}
