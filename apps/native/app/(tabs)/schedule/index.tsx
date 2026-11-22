import StarIcon from "@expo/material-symbols/star.xml";
import WarningIcon from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SectionList,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { ReminderNoticeBanner } from "@/components/ReminderNoticeBanner";
import { SectionHeader } from "@/components/SectionHeader";
import { AgendaGapRow } from "@/components/schedule/AgendaGapRow";
import { AgendaRow } from "@/components/schedule/AgendaRow";
import { TrackedEventBanner } from "@/components/TrackedEventBanner";
import {
  Button,
  EmptyState,
  ReadableColumn,
  ScheduleSkeleton,
  Text,
} from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { useContentWidth } from "@/hooks/useContentWidth";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { ageBadgeFor } from "@/lib/age-badge";
import { type AgendaRowItem, buildAgendaRows } from "@/lib/agenda-gaps";
import {
  agendaGapLabel,
  agendaStatusLabel,
  eventReminderLabel,
  feedStatusLabel,
} from "@/lib/agenda-labels";
import { categoryAccentColor } from "@/lib/category-color";
import { ACTIONS_MAX } from "@/lib/content-width";
import {
  conventionDayKey,
  isValidTimeZone,
  overlappingEventIds,
} from "@/lib/convention-time";
import { useHour12 } from "@/lib/device-clock";
import { getDeviceTimeZone } from "@/lib/display-time-zone";
import { plannedEvent } from "@/lib/drop-in-visit";
import {
  formatClockParts,
  formatDayKeyLabel,
  formatEventEndTime,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  groupPersonalScheduleByDay,
  hasEndedStarredEvents,
  type PersonalScheduleEntry,
  spansMultipleConventions,
} from "@/lib/personal-schedule";
import {
  getReminderReconciliation,
  resolveReminderNotice,
} from "@/lib/reminder-notice";
import { isDropInEvent } from "@/lib/schedule-browse";
import {
  canScrollSchedule,
  scheduleContentStyle,
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

type ScheduleRow = AgendaRowItem<ScheduleEntry>;

interface ScheduleSection {
  key: string;
  data: ScheduleRow[];
}

/**
 * Every saved event across every convention, as one agenda: day headings,
 * the rows in time order, and the gaps between consecutive saved events of
 * the same convention. The walk between two conventions is not a break, so
 * no gap row is drawn across them.
 */
export default function ScheduleScreen() {
  const { conventionId } = useLocalSearchParams<{ conventionId?: string }>();
  const { t } = useTranslation();
  const locale = currentLocale();
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  // iOS applies a Dynamic Type change to a running app, but a VirtualizedList
  // keeps the heights it measured for cells it has already built; the font
  // scale is part of `extraData` so those cells are rebuilt.
  const { fontScale } = useWindowDimensions();
  // On a wide window the list lays its rows into a readable column; zero on a
  // phone in portrait.
  const { listPadding } = useContentWidth();
  const hour12 = useHour12();
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
  const { data: linkedConvention } = useQuery({
    queryKey: ["convention", conventionId],
    queryFn: () => conventionsRepo.getById(conventionId ?? ""),
    enabled: !!conventionId,
  });

  // Stars are toggled from the convention screen and its sheets, so the
  // pooled list is stale by definition every time it comes back into view.
  // Keep time current while this tab stays open, too.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      const interval = setInterval(() => setNow(new Date()), 30_000);
      return () => clearInterval(interval);
    }, [queryClient]),
  );

  const entries = useMemo<ScheduleEntry[]>(() => {
    const deviceTimeZone = getDeviceTimeZone();

    return (rows ?? [])
      .map((row) => ({ ...row, event: plannedEvent(row.event) }))
      .filter((row) => row.event.isInSchedule)
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
  const caughtUpEntry = hasEndedStarredEvents(entries, days)
    ? entries[0]
    : undefined;

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
   * Ids that genuinely clash. Decided with `overlappingEventIds`, the same
   * rule the convention screen uses, over every live saved entry at once --
   * grouping by day first would miss a panel that runs past midnight into
   * the next day's first one. Drop-in programming never clashes.
   */
  const conflictingEventIds = useMemo(() => {
    const live = entries.filter(
      (entry) => entry.event.feedStatus === null && !isDropInEvent(entry.event),
    );
    return overlappingEventIds(
      live.map((entry) => ({
        id: entry.event.id,
        startTime: entry.startTime,
        endTime: entry.endTime,
      })),
    );
  }, [entries]);

  const sections = useMemo<ScheduleSection[]>(() => {
    const nowMs = now.getTime();
    return days.map((day) => {
      const first = day.data[0];
      const todayKey = first ? conventionDayKey(now, first.timeZone) : day.key;
      const measurable = (entry: ScheduleEntry) =>
        entry.event.feedStatus === null && !isDropInEvent(entry.event);
      return {
        key: day.key,
        data: buildAgendaRows(day.data, {
          nowMs,
          timeZone: first?.timeZone ?? "UTC",
          todayKey,
          sameGroup: (previous, next) =>
            previous.conventionId === next.conventionId &&
            measurable(previous) &&
            measurable(next),
        }),
      };
    });
  }, [days, now]);
  const contentKind = sections.length === 0 ? "empty" : "list";
  const contentContainerStyle = useMemo(
    () => scheduleContentStyle(contentKind, listPadding),
    [contentKind, listPadding],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ScheduleSection }) => (
      <SectionHeader title={formatDayKeyLabel(section.key, locale)} />
    ),
    [locale],
  );

  const renderItem = useCallback(
    ({ item }: { item: ScheduleRow }) => {
      if (item.kind === "gap") {
        return (
          <AgendaGapRow gap={item.gap} label={agendaGapLabel(item.gap, t)} />
        );
      }
      const { entry, status } = item;
      const event = entry.event;
      const parts = formatClockParts(
        entry.startTime,
        entry.timeZone,
        locale,
        hour12,
      );
      const end = formatEventEndTime(
        entry.startTime,
        entry.endTime,
        entry.timeZone,
        locale,
        hour12,
      );
      const ageBadge = ageBadgeFor(event.ageRating);
      return (
        <AgendaRow
          title={event.title}
          startClock={parts.clock}
          dayPeriod={parts.dayPeriod}
          untilLabel={
            end ? t("convention.plan.until", { time: end }) : undefined
          }
          room={event.room ?? event.location ?? undefined}
          contextLabel={showConventionName ? entry.conventionName : undefined}
          accentColor={categoryAccentColor(event.category, colorScheme)}
          status={status}
          statusLabel={agendaStatusLabel(status, t)}
          hasConflict={conflictingEventIds.has(event.id)}
          conflictLabel={t("convention.overlapLabel")}
          feedStatusLabel={feedStatusLabel(event.feedStatus, t) ?? undefined}
          reminderLabel={eventReminderLabel(event.reminderMinutes, t)}
          ageBadge={
            ageBadge
              ? { variant: ageBadge.variant, label: t(ageBadge.key) }
              : undefined
          }
          contentWarningLabel={
            event.contentWarning ? t("convention.contentWarning") : undefined
          }
          accessibilityHint={t("schedule.openConventionHint")}
          // There is no standalone event screen -- the sheet that owns
          // stars and reminders lives on the convention. Send the row
          // there rather than inventing a second place to edit the same
          // event, opened on this panel's day with the row highlighted,
          // as a reminder tap does. `highlightAt` makes a second tap on the
          // same panel a new request: the convention screen is reused when it
          // is already open, and identical params would not move it.
          onPress={() =>
            router.push({
              pathname: "/convention/[id]",
              params: {
                id: entry.conventionId,
                highlightEventId: event.id,
                highlightAt: String(Date.now()),
              },
            })
          }
          testID={`schedule-event-${event.id}`}
        />
      );
    },
    [colorScheme, conflictingEventIds, hour12, locale, showConventionName, t],
  );

  if (isLoading) {
    return <ScheduleSkeleton />;
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
        alwaysBounceVertical={shouldBounceSchedule(sections)}
        scrollEnabled={canScrollSchedule(sections.length > 0, fontScale)}
        sections={sections}
        keyExtractor={(row) => row.id}
        // Day headers and row times are formatted at render from values that
        // are not part of `sections`, and VirtualizedList reuses cached cells
        // whenever the data identity is unchanged. A joined string rather than
        // an object so the identity only changes when one of these does.
        extraData={`${locale}|${hour12}|${showConventionName}|${fontScale}`}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={contentContainerStyle}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          sections.length > 0 ? (
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
              <TrackedEventBanner />
              <ReminderNoticeBanner
                notice={reminderNotice}
                overflow={reminderOverflow}
              />
            </View>
          ) : undefined
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListFooterComponent={
          entries.length > 0 ? (
            <ReadableColumn max={ACTIONS_MAX} className="px-4 py-4">
              <Button
                variant="outline"
                onPress={() => {
                  const conventionIds = new Set(
                    entries.map((entry) => entry.conventionId),
                  );
                  if (conventionIds.size === 1) {
                    router.push({
                      pathname: "/convention/[id]",
                      params: { id: entries[0].conventionId, dropIns: "1" },
                    });
                  } else {
                    router.navigate("/(tabs)/(home)");
                  }
                }}
              >
                {t("convention.browse.dropIn.find")}
              </Button>
            </ReadableColumn>
          ) : undefined
        }
        ListEmptyComponent={
          caughtUpEntry ? (
            <EmptyState
              icon={EMPTY_ICON}
              title={t("schedule.caughtUp.title")}
              subtitle={t("schedule.caughtUp.subtitle", {
                name: caughtUpEntry.conventionName,
              })}
              ctaLabel={t("schedule.caughtUp.cta")}
              onCta={() =>
                router.push(`/convention/${caughtUpEntry.conventionId}`)
              }
            />
          ) : linkedConvention ? (
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
