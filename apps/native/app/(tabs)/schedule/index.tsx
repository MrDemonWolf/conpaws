import StarIcon from "@expo/material-symbols/star.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCalendars } from "expo-localization";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, View } from "react-native";
import { EventItem } from "@/components/EventItem";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState, ScheduleSkeleton, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { isValidTimeZone } from "@/lib/convention-time";
import { deviceHour12 } from "@/lib/device-clock";
import { formatDayKeyLabel, formatEventTime } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  groupPersonalScheduleByDay,
  type PersonalScheduleEntry,
  spansMultipleConventions,
} from "@/lib/personal-schedule";
import {
  SCHEDULE_EMPTY_CONTENT_STYLE,
  SCHEDULE_LIST_CONTENT_STYLE,
  shouldBounceSchedule,
} from "@/lib/schedule-list-styles";

const EMPTY_ICON = Icon.select({
  ios: "star",
  android: StarIcon,
});

const ERROR_ICON = Icon.select({
  ios: "exclamationmark.triangle",
  android: WarningIcon,
});

interface ScheduleEntry extends PersonalScheduleEntry {
  event: ConventionEvent;
}

interface ScheduleRowProps {
  entry: ScheduleEntry;
  conventionName?: string;
  locale: string;
  hour12?: boolean;
}

/**
 * Every prop is a primitive or an entry object rebuilt only when the query
 * data changes, so a re-render that leaves the schedule alone -- a focus
 * invalidation that returns the same rows, say -- repaints no rows at all.
 */
const ScheduleRow = memo(function ScheduleRow({
  entry,
  conventionName,
  locale,
  hour12,
}: ScheduleRowProps) {
  return (
    <EventItem
      title={entry.event.title}
      startTime={formatEventTime(
        entry.startTime,
        entry.timeZone,
        locale,
        hour12,
      )}
      endTime={formatEventTime(entry.endTime, entry.timeZone, locale, hour12)}
      room={entry.event.room ?? entry.event.location ?? undefined}
      category={entry.event.category ?? undefined}
      contextLabel={conventionName}
      ageRating={entry.event.ageRating}
      isInSchedule
      contentWarning={entry.event.contentWarning}
      // There is no standalone event screen -- the action sheet that owns
      // stars and reminders lives on the convention. Send the row there
      // rather than inventing a second place to edit the same event.
      onPress={() => router.push(`/convention/${entry.conventionId}`)}
    />
  );
});

export default function ScheduleScreen() {
  const { conventionId } = useLocalSearchParams<{ conventionId?: string }>();
  const { t } = useTranslation();
  const locale = currentLocale();
  const hour12 = deviceHour12();
  const queryClient = useQueryClient();

  const {
    data: rows,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["schedule"],
    queryFn: eventsRepo.getAllInSchedule,
  });
  const showLoading = useDelayedLoading(isLoading);
  const { data: linkedConvention } = useQuery({
    queryKey: ["convention", conventionId],
    queryFn: () => conventionsRepo.getById(conventionId ?? ""),
    enabled: !!conventionId,
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

    return (rows ?? [])
      .filter((row) => !conventionId || row.event.conventionId === conventionId)
      .map((row) => ({
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
  }, [conventionId, rows]);

  const days = useMemo(() => groupPersonalScheduleByDay(entries), [entries]);
  const showConventionName = useMemo(
    () => spansMultipleConventions(entries),
    [entries],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { key: string } }) => (
      <SectionHeader title={formatDayKeyLabel(section.key, locale)} />
    ),
    [locale],
  );

  const renderItem = useCallback(
    ({ item }: { item: ScheduleEntry }) => (
      <ScheduleRow
        entry={item}
        conventionName={showConventionName ? item.conventionName : undefined}
        locale={locale}
        hour12={hour12}
      />
    ),
    [hour12, locale, showConventionName],
  );

  if (isLoading) {
    return showLoading ? (
      <ScheduleSkeleton />
    ) : (
      <View className="flex-1 bg-background" />
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
        alwaysBounceVertical={shouldBounceSchedule(days)}
        sections={days}
        keyExtractor={(entry) => entry.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={
          days.length === 0
            ? SCHEDULE_EMPTY_CONTENT_STYLE
            : SCHEDULE_LIST_CONTENT_STYLE
        }
        ListHeaderComponent={
          days.length > 0 ? (
            <View className="gap-1 px-4 pt-1 pb-2">
              {linkedConvention ? (
                <Text variant="label">{linkedConvention.name}</Text>
              ) : null}
              <Text variant="caption" className="text-muted-foreground">
                {t("schedule.timesShownInConventionTime")}
              </Text>
            </View>
          ) : null
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={
          linkedConvention ? (
            <EmptyState
              icon={EMPTY_ICON}
              title={t("schedule.conventionEmpty.title", {
                name: linkedConvention.name,
              })}
              subtitle={t("schedule.conventionEmpty.subtitle")}
              ctaLabel={t("schedule.conventionEmpty.cta")}
              onCta={() => router.push(`/convention/${linkedConvention.id}`)}
            />
          ) : (
            <EmptyState
              icon={EMPTY_ICON}
              title={t("schedule.empty.title")}
              subtitle={t("schedule.empty.subtitle")}
              ctaLabel={t("schedule.empty.cta")}
              // The Home tab, not "/" — the root route re-runs onboarding.
              onCta={() => router.navigate("/(tabs)/(home)")}
            />
          )
        }
      />
    </View>
  );
}
