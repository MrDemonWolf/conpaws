import { db } from "@/db/client";
import { conventions, conventionEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ExportData } from "@/types";

export interface ImportSummary {
  conventionsAdded: number;
  conventionsSkipped: number;
  eventsAdded: number;
  eventsSkipped: number;
}

export function validateExportData(
  data: unknown,
): data is ExportData {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.version === "number" &&
    typeof d.schemaVersion === "number" &&
    typeof d.exportedAt === "string" &&
    Array.isArray(d.conventions) &&
    Array.isArray(d.events)
  );
}

export async function importData(data: ExportData): Promise<ImportSummary> {
  const summary: ImportSummary = {
    conventionsAdded: 0,
    conventionsSkipped: 0,
    eventsAdded: 0,
    eventsSkipped: 0,
  };

  for (const convention of data.conventions) {
    const existing = await db
      .select()
      .from(conventions)
      .where(eq(conventions.id, convention.id));

    if (existing.length > 0) {
      summary.conventionsSkipped++;
      continue;
    }

    await db.insert(conventions).values(convention);
    summary.conventionsAdded++;
  }

  for (const event of data.events) {
    const existing = await db
      .select()
      .from(conventionEvents)
      .where(eq(conventionEvents.id, event.id));

    if (existing.length > 0) {
      summary.eventsSkipped++;
      continue;
    }

    await db.insert(conventionEvents).values(event);
    summary.eventsAdded++;
  }

  return summary;
}
