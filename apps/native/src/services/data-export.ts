import { useMutation } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention, ConventionEvent } from "@/db/schema";
import { hapticSuccess } from "@/services/haptics";

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

const EXPORT_FILENAME_PREFIX = "conpaws-export-";

/**
 * Drops the exports left behind by earlier runs, so the cache never holds more
 * than the one file the share sheet is about to point at.
 *
 * Deleting the current file once `shareAsync` settles would be tidier but is
 * not safe: on Android that promise resolves when the chooser closes, and the
 * receiving app may still be reading the content:// URI afterwards. Sweeping
 * on the next export reclaims the same space without that race.
 */
function sweepPreviousExports(): void {
  const cache = new Directory(Paths.cache);
  if (!cache.exists) return;

  for (const entry of cache.list()) {
    if (!(entry instanceof File)) continue;
    if (!entry.name.startsWith(EXPORT_FILENAME_PREFIX)) continue;
    try {
      entry.delete();
    } catch {
      // A file the OS is still holding is not worth failing the export over.
    }
  }
}

export async function triggerExport(): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device");
  }

  const payload = await exportAllData();
  const json = JSON.stringify(payload, null, 2);

  sweepPreviousExports();

  const day = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `${EXPORT_FILENAME_PREFIX}${day}.json`);
  file.write(json);

  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Export ConPaws Data",
  });

  hapticSuccess();
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
