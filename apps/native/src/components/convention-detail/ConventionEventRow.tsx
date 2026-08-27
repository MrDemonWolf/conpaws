import type { TFunction } from "i18next";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { EventItem } from "@/components/EventItem";
import type { ConventionEvent } from "@/db/schema";
import { getEventIndicators } from "@/lib/event-indicators";
import { formatEventTime } from "@/lib/event-time-format";
import { hapticLongPress, hapticTap } from "@/services/haptics";

export function getEventIndicatorLabels(
  event: Pick<ConventionEvent, "reminderMinutes" | "sourceUid">,
  t: TFunction,
): { provenanceLabel: string; reminderLabel?: string } {
  const { provenance, reminder } = getEventIndicators(event);

  return {
    provenanceLabel: t(`convention.eventSource.${provenance}`),
    reminderLabel: reminder
      ? t(
          reminder.kind === "hour"
            ? "reminders.hourBefore"
            : "reminders.minutesBefore",
          { minutes: reminder.minutes },
        )
      : undefined,
  };
}

interface ConventionEventRowProps {
  event: ConventionEvent;
  timeZone: string;
  locale: string;
  hour12?: boolean;
  showProvenance: boolean;
  hasConflict: boolean;
  onSelect: (event: ConventionEvent) => void;
}

/**
 * One row of a convention schedule.
 *
 * Memoised on purpose: every prop is a primitive or an object the query cache
 * hands back unchanged, and `onSelect` is stable, so typing in the search bar
 * repaints only the rows whose filtered position actually moved.
 */
export const ConventionEventRow = memo(function ConventionEventRow({
  event,
  timeZone,
  locale,
  hour12,
  showProvenance,
  hasConflict,
  onSelect,
}: ConventionEventRowProps) {
  const { t } = useTranslation();
  const { provenanceLabel, reminderLabel } = getEventIndicatorLabels(event, t);

  return (
    <EventItem
      testID={`convention-event-${event.id}`}
      title={event.title}
      startTime={formatEventTime(event.startTime, timeZone, locale, hour12)}
      endTime={formatEventTime(event.endTime, timeZone, locale, hour12)}
      room={event.room ?? event.location ?? undefined}
      category={event.category ?? undefined}
      description={event.description}
      ageRating={event.ageRating}
      isInSchedule={event.isInSchedule}
      reminderLabel={reminderLabel}
      provenanceLabel={showProvenance ? provenanceLabel : undefined}
      hasConflict={hasConflict}
      contentWarning={event.contentWarning}
      onPress={() => {
        hapticTap();
        onSelect(event);
      }}
      onLongPress={() => {
        hapticLongPress();
        onSelect(event);
      }}
    />
  );
});
