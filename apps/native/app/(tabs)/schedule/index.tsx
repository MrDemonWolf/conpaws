import StarIcon from "@expo/material-symbols/star.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCalendars } from "expo-localization";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, useWindowDimensions, View } from "react-native";
import { EventItem } from "@/components/EventItem";
import { ReminderNoticeBanner } from "@/components/ReminderNoticeBanner";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState, ScheduleSkeleton, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { isValidTimeZone, overlappingEventIds } from "@/lib/convention-time";
import {
  type ClusterPosition,
  type OverlapInfo,
  overlapInfo,
} from "@/lib/day-band";
import { deviceHour12 } from "@/lib/device-clock";
import {
  formatDayKeyLabel,
  formatEventEndTime,
  formatEventTime,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  groupPersonalScheduleByDay,
  type PersonalScheduleEntry,
  spansMultipleConventions,
} from "@/lib/personal-schedule";
import {
  getReminderReconciliation,
  resolveReminderNotice,
} from "@/lib/reminder-notice";
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
  /**
   * True when this row genuinely clashes with another starred event, by the
   * same rule the convention screen uses. Drives the "Overlaps" label, which
   * is a stronger claim than the grouping chrome: the cluster header only
   * says these rows share a time band.
   */
  hasConflict?: boolean;
  /** Overlap grouping from `overlapInfo`, forwarded to the row chrome. */
  overlapPosition?: ClusterPosition;
  overlapGroupSize?: number;
  overlapCount?: number;
  className?: string;
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
  hasConflict,
  overlapPosition,
  overlapGroupSize,
  overlapCount,
  className,
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
      endTime={formatEventEndTime(
        entry.startTime,
        entry.endTime,
        entry.timeZone,
        locale,
        hour12,
      )}
      room={entry.event.room ?? entry.event.location ?? undefined}
      category={entry.event.category ?? undefined}
      contextLabel={conventionName}
      ageRating={entry.event.ageRating}
      isInSchedule
      // Every row on this tab is starred by definition; a star per row would
      // be pure noise.
      showScheduleIndicator={false}
      contentWarning={entry.event.contentWarning}
      feedStatus={entry.event.feedStatus}
      hasConflict={hasConflict}
      overlapPosition={overlapPosition}
      overlapGroupSize={overlapGroupSize}
      overlapCount={overlapCount}
      className={className}
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
  // iOS applies a Dynamic Type change to a running app, but a VirtualizedList
  // keeps the heights it measured for cells it has already built. Rows then
  // draw larger text inside an unchanged box and the glyphs are sliced through
  // the middle. Cold starts are fine, which is why this survived: the damage
  // only shows when the setting is changed while the app is open.
  const { fontScale } = useWindowDimensions();
  const hour12 = deviceHour12();
  const queryClient = useQueryClient();

  const {
    data: rows,
    isLoading,
    isError,
    refetch,
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
  // `now` must refresh alongside it: react-query's structural sharing keeps
  // `rows` reference-stable when the data is unchanged, so a `new Date()`
  // captured inside the grouping memo would freeze at first render and the
  // list would never re-evaluate which events have started or finished.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
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

  const days = useMemo(
    () => groupPersonalScheduleByDay(entries, now),
    [entries, now],
  );

  const notificationPermission = useNotificationPermission();
  const reminderOverflow = getReminderReconciliation().overflow;
  const reminderNotice = resolveReminderNotice({
    permission: notificationPermission,
    reminderCount: entries.filter(
      (entry) => entry.event.reminderMinutes !== null,
    ).length,
    overflow: reminderOverflow,
  });
  const showConventionName = useMemo(
    () => spansMultipleConventions(entries),
    [entries],
  );

  /**
   * Which events actually share a timeframe — drives the grouped tint, accent
   * edge, and header on each row.
   *
   * Computed over the events still running, and keyed by id rather than by
   * position, because a panel the feed dropped is not a clash. Telling someone
   * they have two things at three when one of them was cancelled sends them to
   * resolve a conflict that does not exist. Rows left out of the map render
   * plain, which is the right answer for a marked event.
   */
  const overlapsByEventId = useMemo(() => {
    const byId = new Map<string, OverlapInfo>();
    for (const day of days) {
      const live = day.data.filter((entry) => entry.event.feedStatus === null);
      const info = overlapInfo(live);
      live.forEach((entry, index) => {
        const entryInfo = info[index];
        if (entryInfo) byId.set(entry.event.id, entryInfo);
      });
    }
    return byId;
  }, [days]);

  /**
   * Ids that actually clash, for the "Overlaps" label.
   *
   * Deliberately `overlappingEventIds` rather than `overlapCount > 0` off the
   * map above: the convention screen decides a clash with this function, and
   * the two do not agree. `overlapInfo` gives an event with no end time a
   * fallback duration so it can still be grouped, while this skips it -- an
   * event whose end nobody published is not evidence of a conflict. Deriving
   * the label from the grouping would make My Schedule claim clashes the
   * convention screen does not, for the same two events.
   */
  const conflictingEventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const day of days) {
      const live = day.data.filter((entry) => entry.event.feedStatus === null);
      for (const id of overlappingEventIds(
        live.map((entry) => ({
          id: entry.event.id,
          startTime: entry.startTime,
          endTime: entry.endTime,
        })),
      )) {
        ids.add(id);
      }
    }
    return ids;
  }, [days]);

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
        hasConflict={conflictingEventIds.has(item.event.id)}
        overlapPosition={overlapsByEventId.get(item.event.id)?.position}
        overlapGroupSize={overlapsByEventId.get(item.event.id)?.clusterSize}
        overlapCount={overlapsByEventId.get(item.event.id)?.overlapCount}
      />
    ),
    [
      hour12,
      locale,
      showConventionName,
      overlapsByEventId,
      conflictingEventIds,
    ],
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
        <EmptyState
          icon={ERROR_ICON}
          title={t("schedule.loadError")}
          ctaLabel={t("common.retry")}
          onCta={() => {
            void refetch();
          }}
        />
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
        // Day headers and row times are formatted at render from values that
        // are not part of `days`, and VirtualizedList reuses cached cells
        // whenever the data identity is unchanged. Without this, changing the
        // language left every already-rendered header and time in the previous
        // language -- English chrome above Russian day headers -- until a cold
        // start. A joined string rather than an object so the identity only
        // changes when one of these actually does.
        extraData={`${locale}|${hour12}|${showConventionName}|${fontScale}`}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={
          days.length === 0
            ? SCHEDULE_EMPTY_CONTENT_STYLE
            : SCHEDULE_LIST_CONTENT_STYLE
        }
        ListHeaderComponent={
          days.length > 0 ? (
            <View className="pb-1">
              <View className="gap-1 px-4 pt-1 pb-2">
                {linkedConvention ? (
                  <Text variant="label">{linkedConvention.name}</Text>
                ) : null}
                <Text variant="caption" className="text-muted-foreground">
                  {t("schedule.timesShownInConventionTime")}
                </Text>
              </View>
              {/* Widget deep links land here, so this is where a user with
                  notifications revoked most needs to hear reminders are
                  paused. */}
              <ReminderNoticeBanner
                notice={reminderNotice}
                overflow={reminderOverflow}
              />
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
