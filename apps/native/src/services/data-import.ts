import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Alert } from "react-native";
import { db } from "@/db";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention, ConventionEvent } from "@/db/schema";
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

export async function importData(
  payload: ExportPayload,
): Promise<ImportResult> {
  const existingConventions = await conventionsRepo.getAll();
  const existingIds = new Set(existingConventions.map((c) => c.id));

  const allEventIds = new Set<string>();
  for (const conv of existingConventions) {
    const events = await eventsRepo.getByConventionId(conv.id);
    events.forEach((event) => {
      allEventIds.add(event.id);
    });
  }

  let conventionsAdded = 0;
  let eventsAdded = 0;
  let skipped = 0;

  // Track old export ID → new DB ID for newly created conventions
  const idMap = new Map<string, string>();

  await db.transaction(async () => {
    // Import conventions (skip existing IDs)
    for (const conv of payload.data.conventions) {
      if (existingIds.has(conv.id)) {
        idMap.set(conv.id, conv.id);
        skipped++;
        continue;
      }
      const created = await conventionsRepo.create({
        name: conv.name,
        startDate: conv.startDate,
        endDate: conv.endDate,
        icalUrl: conv.icalUrl,
        status: conv.status,
      });
      idMap.set(conv.id, created.id);
      conventionsAdded++;
    }

    // Import events (skip existing IDs)
    for (const event of payload.data.events) {
      if (allEventIds.has(event.id)) {
        skipped++;
        continue;
      }
      // Resolve the convention ID via the mapping
      const mappedConventionId = idMap.get(event.conventionId);
      if (!mappedConventionId) {
        skipped++;
        continue;
      }
      await eventsRepo.batchInsert([
        {
          conventionId: mappedConventionId,
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          room: event.room,
          category: event.category,
          type: event.type,
          isInSchedule: event.isInSchedule,
          reminderMinutes: event.reminderMinutes,
          sourceUid: event.sourceUid,
          sourceUrl: event.sourceUrl,
          isAgeRestricted: event.isAgeRestricted,
          contentWarning: event.contentWarning,
        },
      ]);
      eventsAdded++;
    }
  });

  return { conventionsAdded, eventsAdded, skipped };
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
