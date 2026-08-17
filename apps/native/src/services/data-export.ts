import { useMutation } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention, ConventionEvent } from "@/db/schema";

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  app: "ConPaws";
  data: {
    conventions: Convention[];
    events: ConventionEvent[];
  };
}

export async function exportAllData(): Promise<ExportPayload> {
  const conventions = await conventionsRepo.getAll();

  const allEvents: ConventionEvent[] = [];
  for (const conv of conventions) {
    const events = await eventsRepo.getByConventionId(conv.id);
    allEvents.push(...events);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "ConPaws",
    data: {
      conventions,
      events: allEvents,
    },
  };
}

export async function triggerExport(): Promise<void> {
  const payload = await exportAllData();
  const json = JSON.stringify(payload, null, 2);

  const filename = `conpaws-export-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File(Paths.cache, filename);
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device");
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Export ConPaws Data",
  });

  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function useExportData() {
  const mutation = useMutation({
    mutationFn: triggerExport,
  });

  return {
    exportData: mutation.mutate,
    isLoading: mutation.isPending,
  };
}
