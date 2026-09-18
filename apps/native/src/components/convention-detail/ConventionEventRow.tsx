import type { TFunction } from "i18next";
import { Bookmark } from "lucide-react-native";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, useColorScheme, View } from "react-native";
import { EventItem } from "@/components/EventItem";
import type { ConventionEvent } from "@/db/schema";
import type { ClusterPosition } from "@/lib/day-band";
import { getEventIndicators } from "@/lib/event-indicators";
import { formatEventEndTime, formatEventTime } from "@/lib/event-time-format";
import { attendanceInterval } from "@/lib/personal-schedule";
import { themeTokens } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";
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
  /** Overlap grouping from `overlapInfo`, forwarded to the row chrome. */
  overlapPosition?: ClusterPosition;
  overlapGroupSize?: number;
  overlapCount?: number;
  onSelect: (event: ConventionEvent) => void;
  onToggleInterest: (event: ConventionEvent) => void;
  /** Day-band background from the section renderer. */
  className?: string;
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
  overlapPosition,
  overlapGroupSize,
  overlapCount,
  onSelect,
  onToggleInterest,
  className,
}: ConventionEventRowProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const { provenanceLabel } = getEventIndicatorLabels(event, t);
  const personalInterval = attendanceInterval(event);
  const hasPersonalTimes =
    event.personalStartTime !== null || event.personalEndTime !== null;

  return (
    <View className="relative">
      <EventItem
        testID={`convention-event-${event.id}`}
        className={cn("pr-14", className)}
        title={event.title}
        startTime={formatEventTime(event.startTime, timeZone, locale, hour12)}
        endTime={formatEventEndTime(
          event.startTime,
          event.endTime,
          timeZone,
          locale,
          hour12,
        )}
        room={event.room ?? event.location ?? undefined}
        category={event.category ?? undefined}
        ageRating={event.ageRating}
        isInSchedule={event.isInSchedule}
        isInterested={event.isInterested}
        attendanceStartTime={
          hasPersonalTimes && !personalInterval.needsReview
            ? formatEventTime(
                personalInterval.startTime,
                timeZone,
                locale,
                hour12,
              )
            : undefined
        }
        attendanceEndTime={
          hasPersonalTimes &&
          !personalInterval.needsReview &&
          personalInterval.endTime
            ? formatEventEndTime(
                personalInterval.startTime,
                personalInterval.endTime,
                timeZone,
                locale,
                hour12,
              )
            : undefined
        }
        attendanceNeedsReview={personalInterval.needsReview}
        provenanceLabel={showProvenance ? provenanceLabel : undefined}
        hasConflict={hasConflict}
        feedStatus={event.feedStatus}
        overlapPosition={overlapPosition}
        overlapGroupSize={overlapGroupSize}
        overlapCount={overlapCount}
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
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: event.isInterested }}
        accessibilityLabel={t(
          event.isInterested
            ? "convention.removeInterest"
            : "convention.addInterest",
        )}
        className="absolute top-2 right-1 min-h-11 w-11 items-center justify-center rounded-full active:bg-muted"
        disabled={event.feedStatus !== null}
        onPress={() => onToggleInterest(event)}
      >
        <Bookmark
          size={22}
          color={themeTokens[isDark ? "dark" : "light"].primary}
          fill={
            event.isInterested
              ? themeTokens[isDark ? "dark" : "light"].primary
              : "transparent"
          }
        />
      </Pressable>
    </View>
  );
});
