import CalendarAddIcon from "@expo/material-symbols/calendar_add_on.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCalendars } from "expo-localization";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, View } from "react-native";
import { EventItem } from "@/components/EventItem";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState, LoadingSpinner, Text } from "@/components/ui";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { isValidTimeZone } from "@/lib/convention-time";
import {
  groupPersonalScheduleByDay,
  type PersonalScheduleEntry,
  spansMultipleConventions,
} from "@/lib/personal-schedule";

const EMPTY_ICON = Icon.select({
  ios: "star",
  android: CalendarAddIcon,
});

const ERROR_ICON = Icon.select({
  ios: "exclamationmark.triangle",
  android: WarningIcon,
});

const EMPTY_LIST_CONTENT_STYLE = { flexGrow: 1 } as const;

interface ScheduleEntry extends PersonalScheduleEntry {
  event: ConventionEvent;
}

function formatTime(
  isoString: string | null,
  timeZone: string,
  locale: string,
): string {
  if (!isoString) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

/**
 * A day key is a plain calendar date, so it is formatted in UTC.
 *
 * Handing "2026-07-04" to a formatter in the device's zone renders it as the
 * 3rd anywhere west of Greenwich.
 */
function formatDayLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${key}T00:00:00Z`));
}

export default function ScheduleScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const queryClient = useQueryClient();

  const {
    data: rows,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["schedule"],
    queryFn: eventsRepo.getAllInSchedule,
  });

  // Stars are toggled from the convention screen and its action sheet, so the
  // pooled list is stale by definition every time it comes back into view.
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    }, [queryClient]),
  );

  const entries = useMemo<ScheduleEntry[]>(() => {
    const deviceTimeZone = getCalendars()[0]?.timeZone ?? "UTC";

    return (rows ?? []).map((row) => ({
      id: row.event.id,
      conventionId: row.event.conventionId,
      conventionName: row.conventionName,
      timeZone: isValidTimeZone(row.conventionTimeZone)
        ? row.conventionTimeZone
        : deviceTimeZone,
      startTime: row.event.startTime,
      endTime: row.event.endTime,
      event: row.event,
    }));
  }, [rows]);

  const days = useMemo(() => groupPersonalScheduleByDay(entries), [entries]);
  const showConventionName = useMemo(
    () => spansMultipleConventions(entries),
    [entries],
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <LoadingSpinner />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState icon={ERROR_ICON} title={t("schedule.loadError")} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <SectionList
        // Same rule as the convention schedule: an empty panel must not
        // rubber-band, but a populated list has to scroll or the iOS large
        // title has no content inset to lay itself into.
        alwaysBounceVertical={days.length > 0}
        sections={days}
        keyExtractor={(entry) => entry.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={
          days.length === 0 ? EMPTY_LIST_CONTENT_STYLE : undefined
        }
        ListHeaderComponent={
          days.length > 0 ? (
            <Text
              variant="caption"
              className="px-4 pt-1 pb-2 text-muted-foreground"
            >
              {t("schedule.timesShownInConventionTime")}
            </Text>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <SectionHeader title={formatDayLabel(section.key, locale)} />
        )}
        renderItem={({ item }) => (
          <EventItem
            title={item.event.title}
            startTime={formatTime(item.startTime, item.timeZone, locale)}
            endTime={formatTime(item.endTime, item.timeZone, locale)}
            room={item.event.room ?? item.event.location ?? undefined}
            category={item.event.category ?? undefined}
            contextLabel={showConventionName ? item.conventionName : undefined}
            ageRating={item.event.ageRating}
            isInSchedule
            contentWarning={item.event.contentWarning}
            // There is no standalone event screen — the action sheet that owns
            // stars and reminders lives on the convention. Send the row there
            // rather than inventing a second place to edit the same event.
            onPress={() => router.push(`/convention/${item.conventionId}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={EMPTY_ICON}
            title={t("schedule.empty.title")}
            subtitle={t("schedule.empty.subtitle")}
            ctaLabel={t("schedule.empty.cta")}
            // The Home tab, not "/" — the root route re-runs the onboarding
            // redirect, which is not what "open my conventions" should do
            // from inside the app.
            onCta={() => router.navigate("/(tabs)/(home)")}
          />
        }
      />
    </View>
  );
}
