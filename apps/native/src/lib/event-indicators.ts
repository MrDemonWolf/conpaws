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
