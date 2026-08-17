import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Alert } from "react-native";
import { db } from "@/db";
import {
  type Convention,
  type ConventionEvent,
  conventionEvents,
  conventions,
} from "@/db/schema";
import { isValidTimeZone } from "@/lib/convention-time";
import type { ExportPayload } from "./data-export";

export interface ImportResult {
  conventionsAdded: number;
  eventsAdded: number;
  skipped: number;
}

export function validateImportFile(payload: unknown): ExportPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid file: not a JSON object");
  }

  const obj = payload as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new Error("Invalid file: unsupported version");
  }
  if (obj.app !== "ConPaws") {
    throw new Error("Invalid file: not a ConPaws export");
  }
  if (typeof obj.data !== "object" || obj.data === null) {
    throw new Error("Invalid file: missing data");
  }

  const data = obj.data as Record<string, unknown>;
  if (!Array.isArray(data.conventions) || !Array.isArray(data.events)) {
    throw new Error("Invalid file: missing conventions or events array");
  }

  return payload as ExportPayload;
}

export interface DataImportPlan {
  conventions: Convention[];
  events: ConventionEvent[];
  result: ImportResult;
}

export function planDataImport(
  payload: ExportPayload,
  existingConventionIds: ReadonlySet<string>,
  existingEventIds: ReadonlySet<string>,
): DataImportPlan {
  const knownConventionIds = new Set(existingConventionIds);
  const knownEventIds = new Set(existingEventIds);
  const conventionsToInsert: Convention[] = [];
  const eventsToInsert: ConventionEvent[] = [];
  let skipped = 0;

  for (const convention of payload.data.conventions) {
    if (knownConventionIds.has(convention.id)) {
      skipped++;
      continue;
    }
    knownConventionIds.add(convention.id);
    conventionsToInsert.push({
      ...convention,
      timeZone: isValidTimeZone(convention.timeZone)
        ? convention.timeZone
        : null,
    });
  }

  for (const event of payload.data.events) {
    if (
      knownEventIds.has(event.id) ||
      !knownConventionIds.has(event.conventionId)
    ) {
      skipped++;
      continue;
    }
    knownEventIds.add(event.id);
    eventsToInsert.push({
      ...event,
      // Restored reminders must be explicitly re-enabled so the OS schedule matches SQLite.
      reminderMinutes: null,
    });
  }

  return {
    conventions: conventionsToInsert,
    events: eventsToInsert,
    result: {
      conventionsAdded: conventionsToInsert.length,
      eventsAdded: eventsToInsert.length,
      skipped,
    },
  };
}

export async function importData(
  payload: ExportPayload,
): Promise<ImportResult> {
  return db.transaction((tx) => {
    const existingConventionIds = new Set(
      tx
        .select({ id: conventions.id })
        .from(conventions)
        .all()
        .map((row) => row.id),
    );
    const existingEventIds = new Set(
      tx
        .select({ id: conventionEvents.id })
        .from(conventionEvents)
        .all()
        .map((row) => row.id),
    );
    const plan = planDataImport(
      payload,
      existingConventionIds,
      existingEventIds,
    );

    for (const convention of plan.conventions) {
      tx.insert(conventions).values(convention).run();
    }
    for (const event of plan.events) {
      tx.insert(conventionEvents).values(event).run();
    }

    return plan.result;
  });
}

export function useImportData() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return null;

      const file = result.assets[0];
      const content = await new File(file.uri).text();

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Invalid file: could not parse JSON");
      }

      const payload = validateImportFile(parsed);

      const convCount = payload.data.conventions.length;
      const eventCount = payload.data.events.length;

      return new Promise<ImportResult | null>((resolve, reject) => {
        Alert.alert(
          "Import Data",
          `Import ${convCount} convention${convCount !== 1 ? "s" : ""} and ${eventCount} event${eventCount !== 1 ? "s" : ""}?`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
            {
              text: "Import",
              onPress: async () => {
                try {
                  const importResult = await importData(payload);
                  resolve(importResult);
                } catch (err) {
                  reject(err);
                }
              },
            },
          ],
        );
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      queryClient.invalidateQueries({ queryKey: ["conventions"] });
      Alert.alert(
        "Import Complete",
        `${result.conventionsAdded} conventions and ${result.eventsAdded} events imported. ${result.skipped} skipped.`,
      );
    },
    onError: (error) => {
      Alert.alert(
        "Import Failed",
        (error as Error).message ?? "Something went wrong.",
      );
    },
  });

  return {
    importData: mutation.mutate,
    isLoading: mutation.isPending,
  };
}
