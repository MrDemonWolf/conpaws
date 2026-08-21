export interface EventIndicatorInput {
  reminderMinutes: number | null;
  sourceUid: string | null;
}

export type EventProvenance = "added" | "imported";

export type EventReminderIndicator = {
  kind: "hour" | "minutes";
  minutes: number;
};

export function getEventIndicators({
  reminderMinutes,
  sourceUid,
}: EventIndicatorInput): {
  provenance: EventProvenance;
  reminder: EventReminderIndicator | null;
} {
  return {
    provenance: sourceUid === null ? "added" : "imported",
    reminder:
      reminderMinutes === null
        ? null
        : {
            kind: reminderMinutes === 60 ? "hour" : "minutes",
            minutes: reminderMinutes,
          },
  };
}

/**
 * Provenance only tells the reader something when a convention actually holds
 * both imported and hand-added events. On an all-imported schedule an
 * "Imported" chip on every row is pure noise, and it pushes the information
 * that does matter -- the age rating -- further down the row.
 */
export function shouldShowProvenance(
  events: readonly EventIndicatorInput[],
): boolean {
  let hasImported = false;
  let hasAdded = false;

  for (const event of events) {
    if (event.sourceUid === null) hasAdded = true;
    else hasImported = true;
    if (hasImported && hasAdded) return true;
  }

  return false;
}
