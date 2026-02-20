import { getAllConventions } from "@/db/repositories/conventions";
import { getEventsByConventionId } from "@/db/repositories/events";
import type { ExportData } from "@/types";

const SCHEMA_VERSION = 1;

export async function exportAllData(): Promise<ExportData> {
  const conventions = await getAllConventions();
  const allEvents = [];

  for (const convention of conventions) {
    const events = await getEventsByConventionId(convention.id);
    allEvents.push(...events);
  }

  return {
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    conventions,
    events: allEvents,
  };
}

export function serializeExportData(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}
