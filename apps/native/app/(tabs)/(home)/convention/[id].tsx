import AddIcon from "@expo/material-symbols/add.xml";
import EventIcon from "@expo/material-symbols/event.xml";
import FilterListIcon from "@expo/material-symbols/filter_list.xml";
import RefreshIcon from "@expo/material-symbols/refresh.xml";
import UploadIcon from "@expo/material-symbols/upload.xml";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { getCalendars } from "expo-localization";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  ScrollView,
  SectionList,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BlankConventionState,
  EMPTY_SCHEDULE_ICON,
} from "@/components/convention-detail/BlankConventionState";
import {
  type ManualEventDraft,
  ManualEventModal,
} from "@/components/convention-detail/ManualEventModal";
import { ScheduleHintCard } from "@/components/convention-detail/ScheduleHintCard";
import { ScheduleUpdateBanner } from "@/components/convention-detail/ScheduleUpdateBanner";
import { SwipeableEventRow } from "@/components/convention-detail/SwipeableEventRow";
import { ReminderNoticeBanner } from "@/components/ReminderNoticeBanner";
import { SectionHeader } from "@/components/SectionHeader";
import {
  Banner,
  EmptyState,
  SafeView,
  ScheduleSkeleton,
  Text,
} from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { useEventScheduleMutations } from "@/hooks/useEventScheduleMutations";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useScheduleRefresh } from "@/hooks/useScheduleRefresh";
import {
  conventionDayKey,
  isValidTimeZone,
  overlappingEventIds,
} from "@/lib/convention-time";
import { type OverlapInfo, overlapInfoAmong } from "@/lib/day-band";
import { resolveConventionPreviewState } from "@/lib/developer-tools";
import { deviceHour12 } from "@/lib/device-clock";
import { shouldShowProvenance } from "@/lib/event-indicators";
import {
  formatConventionDate,
  formatEventDayLabel,
  formatEventTime,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import {
  getReminderReconciliation,
  resolveReminderNotice,
} from "@/lib/reminder-notice";
import {
  dismissScheduleHint,
  isScheduleHintDismissed,
} from "@/lib/schedule-hint-storage";
import {
  SCHEDULE_EMPTY_CONTENT_STYLE,
  SCHEDULE_LIST_CONTENT_STYLE,
  shouldBounceSchedule,
} from "@/lib/schedule-list-styles";
import { getNowAndNextEvents } from "@/lib/schedule-view";
import { hapticSuccess } from "@/services/haptics";

interface DayGroup {
  key: string;
  label: string;
  /** Per-row overlap grouping: which events actually share a timeframe. */
  overlaps: OverlapInfo[];
  data: ConventionEvent[];
}

type ScheduleView = "all" | "mine" | "now-next";

const EMPTY_CONVENTION_CONTENT_STYLE = {
  flexGrow: 1,
  justifyContent: "center",
  paddingBottom: 48,
  paddingTop: 24,
} as const;

function groupEventsByDay(
  events: ConventionEvent[],
  timeZone: string,
  locale: string,
): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const event of events) {
    const key = conventionDayKey(event.startTime, timeZone);
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.data.push(event);
    } else {
      groups.push({
        key,
        label: formatEventDayLabel(event.startTime, timeZone, locale),
        overlaps: [],
        data: [event],
      });
    }
  }

  groups.sort((a, b) => a.key.localeCompare(b.key));
  for (const group of groups) {
    // Group only saved panels — grouping everything tints an entire con day
    // into one block (see overlapInfoAmong).
    group.overlaps = overlapInfoAmong(
      group.data,
      (event) => event.isInSchedule,
    );
  }
  return groups;
}

export default function ConventionDetailScreen() {
  const {
    id,
    previewState: requestedPreviewState,
    highlightEventId,
  } = useLocalSearchParams<{
    id: string;
    previewState?: string;
    /** From a notification tap: scroll to and briefly highlight this event. */
    highlightEventId?: string;
  }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const locale = currentLocale();
  const hour12 = deviceHour12();
  // See the schedule tab: a Dynamic Type change reaches a running app, but
  // already-measured list cells keep their old heights and clip the larger
  // text. Part of `extraData` below so the cells are rebuilt.
  const { fontScale } = useWindowDimensions();
  const previewState = resolveConventionPreviewState(
    requestedPreviewState,
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );
  const presentationLock = useRef(0);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualEventVisible, setManualEventVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const notificationPermission = useNotificationPermission();
  // null while the dismissed flag is loading, so the hint never flashes.
  const [hintDismissed, setHintDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void isScheduleHintDismissed().then((dismissed) => {
      if (active) setHintDismissed(dismissed);
    });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
    }, []),
  );

  const listRef = useRef<SectionList<ConventionEvent, DayGroup>>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(
    null,
  );
  const scrolledToHighlight = useRef(false);

  function openImportSchedule() {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push(`/convention/${id}/import`);
  }

  useEffect(() => {
    if (scheduleView !== "now-next") return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [scheduleView]);

  const {
    data: convention,
    isLoading: conventionLoading,
    isError: conventionError,
    refetch: refetchConvention,
  } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id,
  });

  const {
    data: storedEvents = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsRepo.getByConventionId(id ?? ""),
    enabled: !!id,
  });
  const events = previewState === "empty" ? [] : storedEvents;

  const scheduleRefresh = useScheduleRefresh(convention);

  // No onPermissionDenied flip needed: useNotificationPermission re-reads on
  // focus and foreground, and the sheet route owns the deny alert.
  const { toggleScheduleMutation } = useEventScheduleMutations({
    conventionId: id,
  });

  const addManualEventMutation = useMutation({
    mutationFn: async (event: ManualEventDraft) => {
      if (!id) throw new Error("Convention is missing");
      await eventsRepo.batchInsert([
        {
          conventionId: id,
          title: event.title,
          description: null,
          startTime: event.startTime,
          endTime: event.endTime,
          location: null,
          room: event.room,
          category: null,
          type: null,
          isInSchedule: true,
          reminderMinutes: null,
          sourceUid: null,
          sourceUrl: null,
          isAgeRestricted: false,
          contentWarning: false,
        },
      ]);
    },
    onSuccess: async (_, event) => {
      hapticSuccess();
      await queryClient.invalidateQueries({ queryKey: ["events", id] });
      AccessibilityInfo.announceForAccessibility(
        t("convention.manualEvent.savedAnnouncement", { event: event.title }),
      );
    },
  });

  const openEventActions = useCallback(
    (event: ConventionEvent) => {
      // The sheet is a pushed formSheet route, so the same double-tap guard
      // that protects every other push applies here too.
      if (!tryAcquirePresentationLock(presentationLock)) return;
      router.push(`/convention/${id}/event/${event.id}`);
    },
    [id],
  );

  const scheduledEvents = events.filter((event) => event.isInSchedule);
  /**
   * Saved events the feed still publishes.
   *
   * A marked event stays in the list — that is the whole point of marking it
   * rather than deleting it — but it is not a plan any more. It cannot clash
   * with anything, and it can never be what the user does next, so it is kept
   * out of both of those answers.
   */
  const liveScheduledEvents = scheduledEvents.filter(
    (event) => event.feedStatus === null,
  );
  // One computation per render, not per row.
  const showProvenance = useMemo(() => shouldShowProvenance(events), [events]);
  const conflictingEventIds = overlappingEventIds(liveScheduledEvents);

  const storedTimeZone = convention?.timeZone;
  const conventionTimeZone = isValidTimeZone(storedTimeZone)
    ? storedTimeZone
    : (getCalendars()[0]?.timeZone ?? "UTC");
  const viewEvents = scheduleView === "all" ? events : scheduledEvents;
  const categories = Array.from(
    new Set(
      viewEvents.flatMap((event) => (event.category ? [event.category] : [])),
    ),
  );
  const activeCategory =
    selectedCategory && categories.includes(selectedCategory)
      ? selectedCategory
      : null;
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const hasActiveFilters =
    activeCategory !== null || normalizedSearchQuery.length > 0;
  const filteredEvents = viewEvents.filter(
    (event) =>
      (activeCategory === null || event.category === activeCategory) &&
      (normalizedSearchQuery.length === 0 ||
        [
          event.title,
          event.description ?? "",
          event.category ?? "",
          event.room ?? "",
          event.location ?? "",
        ].some((value) =>
          value.toLocaleLowerCase().includes(normalizedSearchQuery),
        )),
  );
  const dayGroups = groupEventsByDay(
    filteredEvents,
    conventionTimeZone,
    locale,
  );
  const nowAndNext = getNowAndNextEvents(
    filteredEvents.filter((event) => event.feedStatus === null),
    new Date(now),
  );
  const currentConventionDay = conventionDayKey(new Date(), conventionTimeZone);
  const manualEventDefaultDate =
    currentConventionDay >= (convention?.startDate ?? "") &&
    currentConventionDay <= (convention?.endDate ?? "")
      ? currentConventionDay
      : (convention?.startDate ?? currentConventionDay);

  const reminderOverflow = getReminderReconciliation().overflow;
  const reminderNotice = resolveReminderNotice({
    permission: notificationPermission,
    reminderCount: events.filter((event) => event.reminderMinutes !== null)
      .length,
    overflow: reminderOverflow,
  });

  // Stable so the memoised swipe rows only re-render when their inputs change.
  const toggleSchedule = useCallback(
    (event: ConventionEvent) => toggleScheduleMutation.mutate(event),
    [toggleScheduleMutation.mutate],
  );

  // Scroll once to the event a notification tap named, then let the pulse
  // fade. Runs after the day groups exist; a stale or deleted event id is
  // silently ignored.
  useEffect(() => {
    if (!highlightEventId || scrolledToHighlight.current) return;
    for (
      let sectionIndex = 0;
      sectionIndex < dayGroups.length;
      sectionIndex++
    ) {
      const itemIndex = dayGroups[sectionIndex].data.findIndex(
        (event) => event.id === highlightEventId,
      );
      if (itemIndex >= 0) {
        scrolledToHighlight.current = true;
        setHighlightedEventId(highlightEventId);
        listRef.current?.scrollToLocation({
          sectionIndex,
          itemIndex,
          animated: true,
          viewPosition: 0.3,
        });
        const timer = setTimeout(() => setHighlightedEventId(null), 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightEventId, dayGroups]);

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: ConventionEvent;
      index: number;
      section: DayGroup;
    }) => (
      <SwipeableEventRow
        event={item}
        timeZone={conventionTimeZone}
        locale={locale}
        hour12={hour12}
        showProvenance={showProvenance}
        hasConflict={conflictingEventIds.has(item.id)}
        overlapPosition={section.overlaps[index]?.position}
        overlapGroupSize={section.overlaps[index]?.clusterSize}
        overlapCount={section.overlaps[index]?.overlapCount}
        onSelect={openEventActions}
        onToggleSchedule={toggleSchedule}
        className={item.id === highlightedEventId ? "bg-info" : undefined}
      />
    ),
    [
      conflictingEventIds,
      conventionTimeZone,
      hour12,
      locale,
      openEventActions,
      showProvenance,
      toggleSchedule,
      highlightedEventId,
    ],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DayGroup }) => (
      <SectionHeader title={section.label} />
    ),
    [],
  );

  const isLoading =
    previewState === "loading" ||
    (previewState !== "error" && (conventionLoading || eventsLoading));

  const showLoading = useDelayedLoading(isLoading);

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: convention?.name ?? t("convention.loadingTitle"),
          }}
        />
        <SafeView>
          {showLoading ? (
            <ScheduleSkeleton />
          ) : (
            <View className="flex-1 bg-background" />
          )}
        </SafeView>
      </>
    );
  }

  if (previewState === "error" || conventionError || eventsError) {
    return (
      <>
        <Stack.Screen
          options={{ title: convention?.name ?? t("convention.detail") }}
        />
        <SafeView>
          <EmptyState
            className="py-8"
            icon={EMPTY_SCHEDULE_ICON}
            title={t("common.error")}
            subtitle={t("convention.loadErrorSubtitle")}
            ctaLabel={t("common.retry")}
            onCta={() => {
              if (previewState === "error" && id) {
                router.replace(`/convention/${id}`);
                return;
              }
              void Promise.all([refetchConvention(), refetchEvents()]);
            }}
          />
        </SafeView>
      </>
    );
  }

  if (!convention) {
    return (
      <>
        <Stack.Screen options={{ title: t("convention.detail") }} />
        <View className="flex-1 bg-background">
          <EmptyState
            icon="questionmark.folder"
            title={t("convention.notFound")}
            ctaLabel={t("convention.goBack")}
            onCta={() => router.back()}
          />
        </View>
      </>
    );
  }

  const conventionDateRange = t("home.dateRange", {
    start: formatConventionDate(convention.startDate, locale),
    end: formatConventionDate(convention.endDate, locale),
  });

  function renderEventRow(event: ConventionEvent) {
    return (
      <SwipeableEventRow
        key={event.id}
        event={event}
        timeZone={conventionTimeZone}
        locale={locale}
        hour12={hour12}
        showProvenance={showProvenance}
        hasConflict={conflictingEventIds.has(event.id)}
        onSelect={openEventActions}
        onToggleSchedule={toggleSchedule}
      />
    );
  }

  // Teach the star mechanic exactly once: only while there are events, none
  // are starred, and the user has never dismissed the card.
  const showScheduleHint =
    hintDismissed === false &&
    events.length > 0 &&
    scheduledEvents.length === 0;

  const scheduleNotices = (
    <View className="pb-1">
      <Text variant="caption" className="px-4 pt-1 pb-2 text-muted-foreground">
        {t("convention.timesShownIn", { timeZone: conventionTimeZone })}
        {scheduleRefresh.checkedAt !== null
          ? ` · ${t("convention.scheduleUpdate.checkedAt", {
              time: formatEventTime(
                new Date(scheduleRefresh.checkedAt).toISOString(),
                conventionTimeZone,
                locale,
                hour12,
              ),
            })}`
          : ""}
      </Text>
      {scheduleRefresh.summary !== null ? (
        <ScheduleUpdateBanner
          summary={scheduleRefresh.summary}
          onDismiss={scheduleRefresh.dismiss}
        />
      ) : null}
      {showScheduleHint ? (
        <ScheduleHintCard
          onDismiss={() => {
            setHintDismissed(true);
            void dismissScheduleHint();
          }}
        />
      ) : null}
      <ReminderNoticeBanner
        notice={reminderNotice}
        overflow={reminderOverflow}
      />
      {conflictingEventIds.size > 0 ? (
        <Banner
          title={t("convention.overlapSummary", {
            count: conflictingEventIds.size,
          })}
          body={t("convention.overlapHelp")}
        />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background" collapsable={false}>
      <Stack.Screen
        options={{
          title: convention.name,
          headerLargeTitleEnabled: process.env.EXPO_OS === "ios",
          headerLargeTitleShadowVisible: false,
        }}
      />
      {events.length > 0 ? (
        <Stack.SearchBar
          autoCapitalize="none"
          hideWhenScrolling
          placement={process.env.EXPO_OS === "ios" ? "stacked" : "automatic"}
          placeholder={t("convention.searchEvents")}
          onChangeText={(event) => setSearchQuery(event.nativeEvent.text)}
          onCancelButtonPress={() => setSearchQuery("")}
        />
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          onPress={() => {
            if (!tryAcquirePresentationLock(presentationLock)) return;
            router.push(`/convention/${convention.id}/edit`);
          }}
        >
          {t("common.edit")}
        </Stack.Toolbar.Button>
        {events.length > 0 ? (
          <Stack.Toolbar.Menu
            icon={process.env.EXPO_OS === "ios" ? "plus" : AddIcon}
            accessibilityLabel={t("convention.scheduleActions")}
          >
            <Stack.Toolbar.MenuAction
              icon={
                process.env.EXPO_OS === "ios"
                  ? "calendar.badge.plus"
                  : EventIcon
              }
              onPress={() => setManualEventVisible(true)}
            >
              {t("convention.addEvent")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              icon={
                process.env.EXPO_OS === "ios"
                  ? "square.and.arrow.down"
                  : UploadIcon
              }
              onPress={openImportSchedule}
            >
              {t("convention.importSchedule")}
            </Stack.Toolbar.MenuAction>
            {convention?.icalUrl ? (
              <Stack.Toolbar.MenuAction
                icon={
                  process.env.EXPO_OS === "ios"
                    ? "arrow.clockwise"
                    : RefreshIcon
                }
                onPress={scheduleRefresh.checkNow}
              >
                {t(
                  scheduleRefresh.checking
                    ? "convention.scheduleUpdate.checking"
                    : "convention.scheduleUpdate.checkNow",
                )}
              </Stack.Toolbar.MenuAction>
            ) : null}
          </Stack.Toolbar.Menu>
        ) : null}
        {events.length > 0 ? (
          <Stack.Toolbar.Menu
            icon={
              process.env.EXPO_OS === "ios"
                ? "line.3.horizontal.decrease"
                : FilterListIcon
            }
            accessibilityLabel={t("convention.filterEvents")}
          >
            <Stack.Toolbar.MenuAction
              isOn={scheduleView === "all"}
              onPress={() => {
                setScheduleView("all");
                setSelectedCategory(null);
              }}
            >
              {t("convention.allEvents")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={scheduleView === "mine"}
              onPress={() => {
                setScheduleView("mine");
                setSelectedCategory(null);
              }}
            >
              {t("convention.mySchedule")}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction
              isOn={scheduleView === "now-next"}
              onPress={() => {
                setScheduleView("now-next");
                setSelectedCategory(null);
              }}
            >
              {t("convention.nowAndNext")}
            </Stack.Toolbar.MenuAction>
            {categories.length > 0 ? (
              <Stack.Toolbar.Menu title={t("convention.categories")}>
                <Stack.Toolbar.MenuAction
                  isOn={activeCategory === null}
                  onPress={() => setSelectedCategory(null)}
                >
                  {t("convention.allCategories")}
                </Stack.Toolbar.MenuAction>
                {categories.map((category) => (
                  <Stack.Toolbar.MenuAction
                    key={category}
                    isOn={activeCategory === category}
                    onPress={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            ) : null}
          </Stack.Toolbar.Menu>
        ) : null}
      </Stack.Toolbar>
      {/* Events list or empty state */}
      {scheduleView === "now-next" ? (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {scheduleNotices}
          {scheduledEvents.length === 0 ? (
            <EmptyState
              icon={EMPTY_SCHEDULE_ICON}
              title={t("convention.myScheduleEmpty")}
              subtitle={t("convention.myScheduleNowNextSubtitle")}
              ctaLabel={t("convention.showAllEvents")}
              onCta={() => setScheduleView("all")}
            />
          ) : hasActiveFilters && filteredEvents.length === 0 ? (
            <EmptyState
              icon={EMPTY_SCHEDULE_ICON}
              title={t("convention.noMatchingEvents")}
              subtitle={t("convention.noMatchingEventsSubtitle")}
            />
          ) : (
            <>
              <SectionHeader
                title={t("convention.nowCount", {
                  eventCount: nowAndNext.current.length,
                })}
              />
              {nowAndNext.current.length > 0 ? (
                nowAndNext.current.map(renderEventRow)
              ) : (
                <Text
                  variant="body"
                  className="px-4 py-4 text-muted-foreground"
                >
                  {t("convention.nothingHappeningNow")}
                </Text>
              )}

              <SectionHeader
                title={
                  nowAndNext.next[0]
                    ? t("convention.nextAtCount", {
                        time: formatEventTime(
                          nowAndNext.next[0].startTime,
                          conventionTimeZone,
                          locale,
                          hour12,
                        ),
                        eventCount: nowAndNext.next.length,
                      })
                    : t("convention.nextCount", { eventCount: 0 })
                }
              />
              {nowAndNext.next.length > 0 ? (
                nowAndNext.next.map(renderEventRow)
              ) : (
                <Text
                  variant="body"
                  className="px-4 py-4 text-muted-foreground"
                >
                  {t("convention.noMoreUpcomingEvents")}
                </Text>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <SectionList
          ref={listRef}
          // scrollToLocation on unmeasured rows throws; retry once after layout.
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToLocation({
                sectionIndex: 0,
                itemIndex: info.index,
                animated: true,
              });
            }, 250);
          }}
          // Bounce only when there is a schedule to show.
          //
          // Empty states must not bounce -- a centred "no events" panel that
          // rubber-bands looks broken, which is why this was false.
          //
          // But it cannot be false when rows exist. The screen sets
          // headerLargeTitleEnabled, and UIKit only lays the large title into
          // a scroll view's content inset when that view can actually scroll.
          // Bouncing off plus a schedule short enough to fit left the title
          // nowhere to go, so it painted over the first event row and hid its
          // start time.
          alwaysBounceVertical={shouldBounceSchedule(dayGroups)}
          sections={dayGroups}
          keyExtractor={(event) => event.id}
          // Rows close over values that are not part of `dayGroups`, and
          // VirtualizedList reuses cached cells while the data identity holds.
          // `highlightedEventId` is the one that bites soonest -- arriving from
          // a widget deep link changes only this, so the row it names would
          // never repaint with its highlight. Locale and the clock preference
          // have the same problem after a settings change.
          extraData={`${locale}|${hour12}|${showProvenance}|${conventionTimeZone}|${highlightedEventId ?? ""}|${fontScale}`}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={
            dayGroups.length === 0
              ? events.length === 0
                ? EMPTY_CONVENTION_CONTENT_STYLE
                : SCHEDULE_EMPTY_CONTENT_STYLE
              : SCHEDULE_LIST_CONTENT_STYLE
          }
          // The notices also carry the "your schedule changed" banner, and a
          // convention whose feed just emptied has no day groups at all —
          // exactly the moment the user most needs telling.
          ListHeaderComponent={
            dayGroups.length > 0 || scheduleRefresh.summary !== null
              ? scheduleNotices
              : null
          }
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          ListEmptyComponent={
            hasActiveFilters ? (
              <EmptyState
                icon={EMPTY_SCHEDULE_ICON}
                title={t("convention.noMatchingEvents")}
                subtitle={t("convention.noMatchingEventsSubtitle")}
              />
            ) : scheduleView === "mine" ? (
              <EmptyState
                icon={EMPTY_SCHEDULE_ICON}
                title={t("convention.myScheduleEmpty")}
                subtitle={t("convention.myScheduleSubtitle")}
                ctaLabel={t("convention.showAllEvents")}
                onCta={() => setScheduleView("all")}
              />
            ) : (
              <BlankConventionState
                title={t("convention.noEvents")}
                subtitle={t("convention.noEventsSubtitle")}
                dateRange={conventionDateRange}
                timeZoneLabel={t("convention.timesShownIn", {
                  timeZone: conventionTimeZone,
                })}
                importLabel={t("convention.importSchedule")}
                onImport={openImportSchedule}
                addLabel={t("convention.addEvent")}
                onAdd={() => setManualEventVisible(true)}
              />
            )
          }
        />
      )}

      <ManualEventModal
        visible={manualEventVisible}
        defaultDate={manualEventDefaultDate}
        minimumDate={convention.startDate}
        maximumDate={convention.endDate}
        timeZone={conventionTimeZone}
        onClose={() => setManualEventVisible(false)}
        onSave={(event) => addManualEventMutation.mutateAsync(event)}
      />
    </View>
  );
}
