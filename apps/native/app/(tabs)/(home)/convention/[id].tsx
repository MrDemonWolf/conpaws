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
  SectionList,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BlankConventionState,
  EMPTY_SCHEDULE_ICON,
} from "@/components/convention-detail/BlankConventionState";
import {
  ConventionScheduleHeader,
  type ConventionScheduleHeaderProps,
} from "@/components/convention-detail/ConventionScheduleHeader";
import {
  type ManualEventDraft,
  ManualEventModal,
} from "@/components/convention-detail/ManualEventModal";
import { ScheduleHintCard } from "@/components/convention-detail/ScheduleHintCard";
import { ScheduleUpdateBanner } from "@/components/convention-detail/ScheduleUpdateBanner";
import { SwipeableEventRow } from "@/components/convention-detail/SwipeableEventRow";
import { SwipeToggleRow } from "@/components/convention-detail/SwipeToggleRow";
import { ReminderNoticeBanner } from "@/components/ReminderNoticeBanner";
import { SectionHeader } from "@/components/SectionHeader";
import { AgendaGapRow } from "@/components/schedule/AgendaGapRow";
import { AgendaRow } from "@/components/schedule/AgendaRow";
import { DropInRow } from "@/components/schedule/DropInRow";
import type { NowHeroCardProps } from "@/components/schedule/NowHeroCard";
import type { ScheduleView } from "@/components/schedule/ScheduleViewSwitcher.types";
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
import { ageBadgeFor } from "@/lib/age-badge";
import { type AgendaGap, splitMinutes } from "@/lib/agenda-gaps";
import { categoryAccentColor } from "@/lib/category-color";
import { compareCandidates } from "@/lib/compare-candidates";
import {
  conventionDayKey,
  isValidTimeZone,
  overlappingEventIds,
} from "@/lib/convention-time";
import { resolveConventionPreviewState } from "@/lib/developer-tools";
import { deviceHour12 } from "@/lib/device-clock";
import { shouldShowProvenance } from "@/lib/event-indicators";
import {
  formatClockParts,
  formatConventionDate,
  formatDayKeyLabel,
  formatDayKeyMonth,
  formatDayKeyNumber,
  formatDayKeyWeekday,
  formatEventEndTime,
  formatEventTime,
  formatHourLabel,
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
  type BrowseFilters,
  conventionDayKeys,
  dayCounts,
  defaultBrowseDay,
  HOUR_MS,
  hourSlotsFor,
  isDropInEvent,
  selectBrowseEvents,
} from "@/lib/schedule-browse";
import { ALL_DAYS, useScheduleBrowseState } from "@/lib/schedule-browse-store";
import {
  dismissScheduleHint,
  isScheduleHintDismissed,
} from "@/lib/schedule-hint-storage";
import {
  SCHEDULE_EMPTY_CONTENT_STYLE,
  SCHEDULE_LIST_CONTENT_STYLE,
  shouldBounceSchedule,
} from "@/lib/schedule-list-styles";
import {
  buildAgendaSections,
  buildBrowseSections,
  buildNowSections,
  type ScheduleRow,
  type ScheduleSection,
} from "@/lib/schedule-sections";
import { localizedTimeZoneName } from "@/lib/time-zone-name";
import { hapticSuccess } from "@/services/haptics";

type Row = ScheduleRow<ConventionEvent>;
type Section = ScheduleSection<ConventionEvent>;

const EMPTY_CONVENTION_CONTENT_STYLE = {
  flexGrow: 1,
  justifyContent: "center",
  paddingBottom: 48,
  paddingTop: 24,
} as const;

/** The views, in the order the segmented control shows them. */
const VIEW_LABEL_KEYS: Record<ScheduleView, string> = {
  all: "convention.views.all",
  mine: "convention.views.mine",
  now: "convention.views.now",
};

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
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";
  // A Dynamic Type change reaches a running app, but already-measured list
  // cells keep their old heights and clip the larger text. Part of
  // `extraData` below so the cells are rebuilt.
  const { fontScale } = useWindowDimensions();
  const previewState = resolveConventionPreviewState(
    requestedPreviewState,
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );
  const presentationLock = useRef(0);

  const [view, setView] = useState<ScheduleView>("all");
  const [browse, setBrowse] = useScheduleBrowseState(id ?? "");
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
      setNow(Date.now());
    }, []),
  );

  const listRef = useRef<SectionList<Row, Section>>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(
    null,
  );
  const scrolledToHighlight = useRef(false);

  function openImportSchedule() {
    if (!tryAcquirePresentationLock(presentationLock)) return;
    router.push(`/convention/${id}/import`);
  }

  // The plan and now views say what is running and what has ended, so they
  // keep a clock; the browse view does not need one.
  useEffect(() => {
    if (view === "all") return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [view]);

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

  const openCompare = useCallback(
    (candidateId: string) => {
      if (!tryAcquirePresentationLock(presentationLock)) return;
      router.push({
        pathname: "/convention/[id]/compare",
        params: { id: id ?? "", candidateId },
      });
    },
    [id],
  );

  const scheduledEvents = useMemo(
    () => events.filter((event) => event.isInSchedule),
    [events],
  );
  /**
   * Saved events the feed still publishes. A marked event stays in the list
   * -- that is the point of marking rather than deleting it -- but it is not
   * a plan any more: it cannot clash with anything and can never be what the
   * user does next.
   */
  const liveScheduledEvents = useMemo(
    () => scheduledEvents.filter((event) => event.feedStatus === null),
    [scheduledEvents],
  );
  // One computation per render, not per row.
  const showProvenance = useMemo(() => shouldShowProvenance(events), [events]);
  // Drop-in programming never clashes: a room open all day is not a
  // commitment that competes with a panel.
  const conflictingEventIds = useMemo(
    () =>
      overlappingEventIds(
        liveScheduledEvents.filter((event) => !isDropInEvent(event)),
      ),
    [liveScheduledEvents],
  );

  const storedTimeZone = convention?.timeZone;
  const conventionTimeZone = isValidTimeZone(storedTimeZone)
    ? storedTimeZone
    : (getCalendars()[0]?.timeZone ?? "UTC");
  const todayKey = conventionDayKey(new Date(now), conventionTimeZone);

  // The day strip: the convention's days plus any an event spills onto.
  const dayKeys = useMemo(
    () =>
      conventionDayKeys(
        convention?.startDate ?? todayKey,
        convention?.endDate ?? todayKey,
        events,
        conventionTimeZone,
      ),
    [
      convention?.startDate,
      convention?.endDate,
      events,
      conventionTimeZone,
      todayKey,
    ],
  );
  const counts = useMemo(
    () => dayCounts(events, conventionTimeZone),
    [events, conventionTimeZone],
  );
  const selectedDayKey =
    browse.dayKey ?? defaultBrowseDay(dayKeys, counts, todayKey) ?? ALL_DAYS;
  const effectiveDay = selectedDayKey === ALL_DAYS ? null : selectedDayKey;

  const slots = useMemo(
    () => hourSlotsFor(events, effectiveDay, conventionTimeZone),
    [events, effectiveDay, conventionTimeZone],
  );
  // An hour chosen on another day may not exist on this one.
  const slotStartMs =
    browse.slotStartMs !== null && slots.includes(browse.slotStartMs)
      ? browse.slotStartMs
      : null;

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          events.flatMap((event) => (event.category ? [event.category] : [])),
        ),
      ),
    [events],
  );
  const activeCategory =
    browse.category && categories.includes(browse.category)
      ? browse.category
      : null;

  const filters = useMemo<BrowseFilters>(
    () => ({
      dayKey: effectiveDay,
      slotStartMs,
      category: activeCategory,
      query: searchQuery,
    }),
    [effectiveDay, slotStartMs, activeCategory, searchQuery],
  );
  const selection = useMemo(
    () => selectBrowseEvents(events, filters, conventionTimeZone),
    [events, filters, conventionTimeZone],
  );
  const browseSections = useMemo(
    () => buildBrowseSections(selection, filters, conventionTimeZone),
    [selection, filters, conventionTimeZone],
  );
  const agendaSections = useMemo(
    () =>
      buildAgendaSections(scheduledEvents, effectiveDay, {
        nowMs: now,
        timeZone: conventionTimeZone,
        todayKey,
      }),
    [scheduledEvents, effectiveDay, now, conventionTimeZone, todayKey],
  );
  const nowSelection = useMemo(
    () => buildNowSections(events, scheduledEvents, now, conventionTimeZone),
    [events, scheduledEvents, now, conventionTimeZone],
  );
  const sections =
    view === "all"
      ? browseSections
      : view === "mine"
        ? agendaSections
        : nowSelection.sections;

  const hasActiveFilters =
    activeCategory !== null ||
    slotStartMs !== null ||
    searchQuery.trim().length > 0;
  const hasClearableFilters = activeCategory !== null || slotStartMs !== null;

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

  // Stable so the memoised rows only re-render when their inputs change.
  const toggleSchedule = useCallback(
    (event: ConventionEvent) => toggleScheduleMutation.mutate(event),
    [toggleScheduleMutation.mutate],
  );

  /**
   * The star button: saving an event that collides with a saved one opens the
   * compare sheet instead of silently stacking two plans; everything else is
   * an instant toggle, like the swipe.
   */
  const handleStarPress = useCallback(
    (event: ConventionEvent) => {
      if (!event.isInSchedule) {
        const set = compareCandidates(events, event.id);
        if (set && set.conflicts.length > 0) {
          openCompare(event.id);
          return;
        }
      }
      toggleSchedule(event);
    },
    [events, openCompare, toggleSchedule],
  );

  const clearFilters = useCallback(() => {
    setBrowse({ category: null, slotStartMs: null });
  }, [setBrowse]);

  // Scroll once to the event a notification tap named, then let the pulse
  // fade. Runs after the sections exist; a stale or deleted event id is
  // silently ignored. The browse state is reset first so the row is on
  // screen whatever was filtered before the tap.
  useEffect(() => {
    if (!highlightEventId || scrolledToHighlight.current) return;
    const target = events.find((event) => event.id === highlightEventId);
    if (!target) return;
    if (view !== "all") {
      setView("all");
      return;
    }
    const targetDay = conventionDayKey(target.startTime, conventionTimeZone);
    if (
      (effectiveDay !== null && effectiveDay !== targetDay) ||
      slotStartMs !== null ||
      activeCategory !== null
    ) {
      setBrowse({ dayKey: targetDay, slotStartMs: null, category: null });
      return;
    }
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const itemIndex = sections[sectionIndex].data.findIndex(
        (row) => row.id === highlightEventId,
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
  }, [
    highlightEventId,
    events,
    sections,
    view,
    effectiveDay,
    slotStartMs,
    activeCategory,
    conventionTimeZone,
    setBrowse,
  ]);

  const minutesLeftLabel = (count: number) =>
    t(
      count === 1
        ? "convention.now.minutesLeftOne"
        : "convention.now.minutesLeftMany",
      { count },
    );
  const minutesUntilLabel = (count: number) =>
    t(
      count === 1
        ? "convention.now.minutesUntilOne"
        : "convention.now.minutesUntilMany",
      { count },
    );

  const gapLabel = useCallback(
    (gap: AgendaGap): string => {
      if (gap.kind === "backToBack") return t("convention.plan.gap.backToBack");
      if (gap.kind === "overlap")
        return t("convention.plan.gap.overlap", { minutes: gap.minutes });
      if (gap.hint === "short")
        return t("convention.plan.gap.free", { minutes: gap.minutes });
      const { hours, minutes } = splitMinutes(gap.minutes);
      return minutes === 0
        ? t("convention.plan.gap.freeHours", { hours })
        : t("convention.plan.gap.freeHoursMinutes", { hours, minutes });
    },
    [t],
  );

  const renderItem = useCallback(
    ({ item, section }: { item: Row; section: Section }) => {
      switch (item.kind) {
        case "event": {
          const overlap = section.overlapsById.get(item.id);
          const event = item.event;
          return (
            <SwipeableEventRow
              event={event}
              timeZone={conventionTimeZone}
              locale={locale}
              hour12={hour12}
              showProvenance={showProvenance}
              hasConflict={conflictingEventIds.has(event.id)}
              overlapPosition={overlap?.position}
              overlapGroupSize={overlap?.clusterSize}
              overlapCount={overlap?.overlapCount}
              accentColor={categoryAccentColor(event.category, colorScheme)}
              savedLabel={t("convention.savedLabel")}
              trailingAction={{
                label: t(
                  event.isInSchedule
                    ? "convention.unsaveAction"
                    : "convention.saveAction",
                  { title: event.title },
                ),
                selected: event.isInSchedule,
                onPress: () => handleStarPress(event),
                testID: `convention-event-star-${event.id}`,
              }}
              onSelect={openEventActions}
              onToggleSchedule={toggleSchedule}
              className={item.id === highlightedEventId ? "bg-info" : undefined}
            />
          );
        }
        case "dropIn": {
          const event = item.event;
          const day = formatDayKeyWeekday(
            conventionDayKey(event.startTime, conventionTimeZone),
            locale,
          );
          const start = formatEventTime(
            event.startTime,
            conventionTimeZone,
            locale,
            hour12,
          );
          const end = formatEventEndTime(
            event.startTime,
            event.endTime,
            conventionTimeZone,
            locale,
            hour12,
          );
          const summary = [
            `${day} · ${t("convention.eventTimeRange", { start, end })}`,
            event.room ?? event.location,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <DropInRow
              title={event.title}
              summary={summary}
              accessibilityLabel={`${event.title}, ${summary}`}
              accessibilityHint={t("convention.eventActionsHint")}
              onPress={() => openEventActions(event)}
              testID={`convention-event-${event.id}`}
            />
          );
        }
        case "agenda": {
          const event = item.event;
          const parts = formatClockParts(
            event.startTime,
            conventionTimeZone,
            locale,
            hour12,
          );
          const end = formatEventEndTime(
            event.startTime,
            event.endTime,
            conventionTimeZone,
            locale,
            hour12,
          );
          const ageBadge = ageBadgeFor(event.ageRating);
          const statusLabel =
            item.status === "now"
              ? t("convention.plan.status.now")
              : item.status === "endedToday"
                ? t("convention.plan.status.endedToday")
                : item.status === "ended"
                  ? t("convention.plan.status.ended")
                  : undefined;
          return (
            <SwipeToggleRow
              removeLabel={t("common.remove")}
              onToggle={() => toggleSchedule(event)}
            >
              <AgendaRow
                title={event.title}
                startClock={parts.clock}
                dayPeriod={parts.dayPeriod}
                untilLabel={
                  end ? t("convention.plan.until", { time: end }) : undefined
                }
                room={event.room ?? event.location ?? undefined}
                accentColor={categoryAccentColor(event.category, colorScheme)}
                status={item.status}
                statusLabel={statusLabel}
                hasConflict={conflictingEventIds.has(event.id)}
                conflictLabel={t("convention.overlapLabel")}
                feedStatusLabel={
                  event.feedStatus
                    ? t(
                        event.feedStatus === "cancelled"
                          ? "convention.feedStatus.cancelled"
                          : "convention.feedStatus.removed",
                      )
                    : undefined
                }
                reminderLabel={
                  event.reminderMinutes !== null
                    ? t(
                        event.reminderMinutes === 60
                          ? "reminders.hourBefore"
                          : "reminders.minutesBefore",
                        { minutes: event.reminderMinutes },
                      )
                    : undefined
                }
                ageBadge={
                  ageBadge
                    ? { variant: ageBadge.variant, label: t(ageBadge.key) }
                    : undefined
                }
                contentWarningLabel={
                  event.contentWarning
                    ? t("convention.contentWarning")
                    : undefined
                }
                accessibilityHint={t("convention.eventActionsHint")}
                onPress={() => openEventActions(event)}
                onLongPress={() => openEventActions(event)}
                testID={`convention-event-${event.id}`}
                className={
                  item.id === highlightedEventId ? "bg-info" : undefined
                }
              />
            </SwipeToggleRow>
          );
        }
        case "gap":
          return <AgendaGapRow gap={item.gap} label={gapLabel(item.gap)} />;
      }
    },
    [
      colorScheme,
      conflictingEventIds,
      conventionTimeZone,
      gapLabel,
      handleStarPress,
      highlightedEventId,
      hour12,
      locale,
      openEventActions,
      showProvenance,
      t,
      toggleSchedule,
    ],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => {
      const heading = section.heading;
      switch (heading.kind) {
        case "day":
          return (
            <SectionHeader title={formatDayKeyLabel(heading.dayKey, locale)} />
          );
        case "planDay":
          return (
            <SectionHeader
              title={formatDayKeyLabel(heading.dayKey, locale)}
              subtitle={t(
                heading.count === 1
                  ? "convention.plan.savedCountOne"
                  : "convention.plan.savedCountMany",
                { count: heading.count },
              )}
            />
          );
        case "dropIns":
          return (
            <SectionHeader
              title={t("convention.browse.dropIn.title")}
              subtitle={t("convention.browse.dropIn.subtitle")}
            />
          );
        case "otherOptions":
          return (
            <SectionHeader
              title={t("convention.now.otherOptions")}
              subtitle={t(
                heading.count === 1
                  ? "convention.browse.optionsOne"
                  : "convention.browse.optionsMany",
                { count: heading.count },
              )}
            />
          );
        default:
          return null;
      }
    },
    [locale, t],
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

  // Teach the star mechanic exactly once: only while there are events, none
  // are starred, and the user has never dismissed the card.
  const showScheduleHint =
    hintDismissed === false &&
    events.length > 0 &&
    scheduledEvents.length === 0;

  const scheduleNotices = (
    <View>
      <Text variant="caption" className="px-4 pb-1 text-muted-foreground">
        {t("convention.timesShownIn", {
          timeZone: localizedTimeZoneName(conventionTimeZone, locale),
        })}
        {scheduleRefresh.checking
          ? ` · ${t("convention.status.checking")}`
          : scheduleRefresh.checkedAt !== null
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
      {scheduleRefresh.failed ? (
        <Banner
          title={t("convention.scheduleUpdate.checkFailedTitle")}
          body={t("convention.scheduleUpdate.checkFailedMessage")}
          actionLabel={t("common.retry")}
          onAction={scheduleRefresh.checkNow}
          dismissLabel={t("convention.scheduleUpdate.dismiss")}
          onDismiss={scheduleRefresh.dismiss}
        />
      ) : null}
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
      {browse.notice === "updated" ? (
        <Banner
          tone="success"
          title={t("convention.plan.updated.title")}
          body={t("convention.plan.updated.body")}
          dismissLabel={t("convention.scheduleUpdate.dismiss")}
          onDismiss={() => setBrowse({ notice: null })}
        />
      ) : null}
      {conflictingEventIds.size > 0 && view !== "now" ? (
        <Banner
          title={t("convention.plan.overlap.title")}
          body={t("convention.plan.overlap.body")}
          actionLabel={t("convention.plan.overlap.cta")}
          onAction={() => {
            const first = liveScheduledEvents
              .filter((event) => conflictingEventIds.has(event.id))
              .sort(
                (left, right) =>
                  Date.parse(left.startTime) - Date.parse(right.startTime),
              )[0];
            if (first) openCompare(first.id);
          }}
        />
      ) : null}
    </View>
  );

  // The day strip and chips are derived from already-memoised inputs; the
  // header component is memoised, so a render that leaves these unchanged
  // repaints nothing above the rows.
  const monthKey = effectiveDay ?? dayKeys[0] ?? todayKey;
  const dayStrip: ConventionScheduleHeaderProps["dayStrip"] =
    view === "now" || dayKeys.length === 0
      ? null
      : {
          monthLabel: formatDayKeyMonth(monthKey, locale),
          days: dayKeys.map((key) => ({
            key,
            weekday: formatDayKeyWeekday(key, locale),
            dayNumber: formatDayKeyNumber(key, locale),
            count: counts.get(key) ?? 0,
            accessibilityLabel: t("convention.browse.dayAccessibility", {
              day: formatDayKeyLabel(key, locale),
              count: counts.get(key) ?? 0,
            }),
          })),
          selectedKey: selectedDayKey,
          allKey: ALL_DAYS,
          allLabel: t("convention.browse.allDays"),
          allCount: dayKeys.length,
          allAccessibilityLabel: t("convention.browse.allDaysAccessibility", {
            count: dayKeys.length,
          }),
          onSelect: (key) => setBrowse({ dayKey: key }),
        };

  const timeChips: ConventionScheduleHeaderProps["timeChips"] =
    view === "all" && events.length > 0
      ? {
          slots: slots.map((startMs) => ({
            startMs,
            label: formatHourLabel(startMs, conventionTimeZone, locale, hour12),
            accessibilityLabel: t("convention.browse.slotAccessibility", {
              start: formatHourLabel(
                startMs,
                conventionTimeZone,
                locale,
                hour12,
              ),
              end: formatHourLabel(
                startMs + HOUR_MS,
                conventionTimeZone,
                locale,
                hour12,
              ),
            }),
          })),
          selectedStartMs: slotStartMs,
          allTimesLabel: t("convention.browse.allTimes"),
          onSelect: (startMs) => setBrowse({ slotStartMs: startMs }),
        }
      : null;

  const summaryHeading =
    slotStartMs !== null
      ? t(
          effectiveDay === null
            ? "convention.browse.headingSlotAllDays"
            : "convention.browse.headingSlot",
          {
            start: formatHourLabel(
              slotStartMs,
              conventionTimeZone,
              locale,
              hour12,
            ),
            end: formatHourLabel(
              slotStartMs + HOUR_MS,
              conventionTimeZone,
              locale,
              hour12,
            ),
          },
        )
      : effectiveDay === null
        ? t("convention.browse.headingAllDays")
        : t("convention.browse.headingDay", {
            day: formatDayKeyWeekday(effectiveDay, locale),
          });
  const browseCount = selection.rows.length;
  const summary: ConventionScheduleHeaderProps["summary"] =
    view === "all" && events.length > 0
      ? {
          heading: summaryHeading,
          countLabel:
            effectiveDay === null
              ? `${t(browseCount === 1 ? "convention.browse.optionsOne" : "convention.browse.optionsMany", { count: browseCount })} · ${t(selection.dayCount === 1 ? "convention.browse.daysOne" : "convention.browse.daysMany", { count: selection.dayCount })}`
              : t(
                  browseCount === 1
                    ? "convention.browse.optionsOne"
                    : "convention.browse.optionsMany",
                  { count: browseCount },
                ),
          totalLabel:
            browseCount !== selection.total
              ? t("convention.browse.total", { count: selection.total })
              : undefined,
          hint: activeCategory
            ? {
                text: t("convention.browse.filterActive", {
                  category: activeCategory,
                }),
                actionLabel: t("convention.browse.clearFilters"),
                onAction: clearFilters,
              }
            : { text: t("convention.browse.hint") },
        }
      : null;

  const hero = nowSelection.hero;
  const heroEvent = hero?.event ?? null;
  const heroProps: NowHeroCardProps | null =
    view === "now" && hero && heroEvent
      ? {
          eyebrow: t(
            hero.kind === "current"
              ? "convention.now.happeningNow"
              : "convention.now.upNext",
          ),
          title: heroEvent.title,
          timeLine: heroEvent.endTime
            ? t("convention.eventTimeRange", {
                start: formatEventTime(
                  heroEvent.startTime,
                  conventionTimeZone,
                  locale,
                  hour12,
                ),
                end: formatEventEndTime(
                  heroEvent.startTime,
                  heroEvent.endTime,
                  conventionTimeZone,
                  locale,
                  hour12,
                ),
              })
            : formatEventTime(
                heroEvent.startTime,
                conventionTimeZone,
                locale,
                hour12,
              ),
          callout:
            hero.kind === "current"
              ? heroEvent.endTime
                ? {
                    label: t("convention.now.until"),
                    value: formatEventEndTime(
                      heroEvent.startTime,
                      heroEvent.endTime,
                      conventionTimeZone,
                      locale,
                      hour12,
                    ),
                    sub: minutesLeftLabel(
                      Math.max(
                        0,
                        Math.round(
                          (Date.parse(heroEvent.endTime) - now) / 60_000,
                        ),
                      ),
                    ),
                  }
                : {
                    label: t("convention.now.until"),
                    value: t("convention.now.unknownEnd"),
                  }
              : {
                  label: t("convention.now.startsAt"),
                  value: formatEventTime(
                    heroEvent.startTime,
                    conventionTimeZone,
                    locale,
                    hour12,
                  ),
                  sub: minutesUntilLabel(
                    Math.max(
                      0,
                      Math.round(
                        (Date.parse(heroEvent.startTime) - now) / 60_000,
                      ),
                    ),
                  ),
                },
          room: heroEvent.room ?? heroEvent.location ?? undefined,
          venue:
            heroEvent.room && heroEvent.location
              ? heroEvent.location
              : (convention.location ?? undefined),
          reminderLabel:
            heroEvent.reminderMinutes !== null
              ? t("convention.now.reminder", {
                  label: t(
                    heroEvent.reminderMinutes === 60
                      ? "reminders.hourBefore"
                      : heroEvent.reminderMinutes === 0
                        ? "reminders.atTime"
                        : "reminders.minutesBefore",
                    { minutes: heroEvent.reminderMinutes },
                  ),
                })
              : undefined,
          next: hero.following
            ? {
                kicker: t("convention.now.next", {
                  time: formatEventTime(
                    hero.following.startTime,
                    conventionTimeZone,
                    locale,
                    hour12,
                  ),
                }),
                title: hero.following.title,
                meta: [
                  hero.following.room ?? hero.following.location,
                  hero.gap ? gapLabel(hero.gap) : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                onPress: () => {
                  if (hero.following) openEventActions(hero.following);
                },
                accessibilityLabel: t("convention.now.nextAccessibility", {
                  title: hero.following.title,
                }),
              }
            : undefined,
          primaryLabel: t(
            heroEvent.reminderMinutes === null
              ? "convention.now.setReminder"
              : "convention.now.openPanel",
          ),
          onPrimary: () => openEventActions(heroEvent),
          onOpen: () => openEventActions(heroEvent),
          openAccessibilityLabel: t("convention.now.openAccessibility", {
            title: heroEvent.title,
          }),
        }
      : null;

  const nowNotice: ConventionScheduleHeaderProps["nowNotice"] =
    view !== "now" || hero
      ? null
      : liveScheduledEvents.length === 0
        ? {
            icon: EMPTY_SCHEDULE_ICON,
            title: t("convention.now.nothingPicked.title"),
            subtitle: t("convention.now.nothingPicked.body"),
            ctaLabel: t("convention.now.nothingPicked.cta"),
            onCta: () => setView("all"),
          }
        : nowSelection.finishedForToday
          ? {
              icon: "checkmark.circle",
              title: t("convention.now.finished.title"),
              subtitle: nowSelection.nextAnotherDay
                ? t("convention.now.finished.nextDay", {
                    title: nowSelection.nextAnotherDay.title,
                    day: formatDayKeyLabel(
                      conventionDayKey(
                        nowSelection.nextAnotherDay.startTime,
                        conventionTimeZone,
                      ),
                      locale,
                    ),
                    time: formatEventTime(
                      nowSelection.nextAnotherDay.startTime,
                      conventionTimeZone,
                      locale,
                      hour12,
                    ),
                  })
                : t("convention.now.finished.body"),
              ctaLabel: t("convention.now.nothingPicked.cta"),
              onCta: () => setView("all"),
            }
          : nowSelection.nextAnotherDay
            ? {
                icon: EMPTY_SCHEDULE_ICON,
                title: t("convention.now.nothingToday.title"),
                subtitle: t("convention.now.finished.nextDay", {
                  title: nowSelection.nextAnotherDay.title,
                  day: formatDayKeyLabel(
                    conventionDayKey(
                      nowSelection.nextAnotherDay.startTime,
                      conventionTimeZone,
                    ),
                    locale,
                  ),
                  time: formatEventTime(
                    nowSelection.nextAnotherDay.startTime,
                    conventionTimeZone,
                    locale,
                    hour12,
                  ),
                }),
              }
            : {
                icon: EMPTY_SCHEDULE_ICON,
                title: t("convention.now.allEnded.title"),
                subtitle: t("convention.now.allEnded.body"),
                ctaLabel: t("convention.now.nothingPicked.cta"),
                onCta: () => setView("all"),
              };

  const listHeader = (
    <ConventionScheduleHeader
      view={view}
      onChangeView={setView}
      viewLabels={{
        all: t(VIEW_LABEL_KEYS.all),
        mine: t(VIEW_LABEL_KEYS.mine),
        now: t(VIEW_LABEL_KEYS.now),
      }}
      viewAccessibilityLabel={t("convention.views.accessibility")}
      notices={scheduleNotices}
      dayStrip={dayStrip}
      timeChips={timeChips}
      summary={summary}
      hero={heroProps}
      nowNotice={nowNotice}
      alsoNowLabel={
        view === "now" && hero && hero.alsoNow.length > 0
          ? t(
              hero.alsoNow.length === 1
                ? "convention.now.alsoNowOne"
                : "convention.now.alsoNowMany",
              { count: hero.alsoNow.length },
            )
          : undefined
      }
    />
  );

  const emptyComponent =
    view === "all" ? (
      events.length === 0 ? (
        <BlankConventionState
          title={t("convention.noEvents")}
          subtitle={t("convention.noEventsSubtitle")}
          dateRange={conventionDateRange}
          timeZoneLabel={t("convention.timesShownIn", {
            timeZone: localizedTimeZoneName(conventionTimeZone, locale),
          })}
          importLabel={t("convention.importSchedule")}
          onImport={openImportSchedule}
          addLabel={t("convention.addEvent")}
          onAdd={() => setManualEventVisible(true)}
        />
      ) : hasActiveFilters ? (
        <EmptyState
          compact
          icon={EMPTY_SCHEDULE_ICON}
          title={t("convention.browse.noMatches.title")}
          subtitle={t("convention.browse.noMatches.body")}
          ctaLabel={
            hasClearableFilters
              ? t("convention.browse.clearFilters")
              : undefined
          }
          onCta={hasClearableFilters ? clearFilters : undefined}
        />
      ) : (
        <EmptyState
          compact
          icon={EMPTY_SCHEDULE_ICON}
          title={t("convention.browse.noneThisDay.title")}
          subtitle={t("convention.browse.noneThisDay.body")}
          ctaLabel={t("convention.browse.allDaysCta")}
          onCta={() => setBrowse({ dayKey: ALL_DAYS })}
        />
      )
    ) : view === "mine" ? (
      scheduledEvents.length === 0 ? (
        <EmptyState
          compact
          icon={EMPTY_SCHEDULE_ICON}
          title={t("convention.plan.emptyConvention.title")}
          subtitle={t("convention.plan.emptyConvention.body")}
          ctaLabel={t("convention.plan.empty.cta")}
          onCta={() => setView("all")}
        />
      ) : (
        <EmptyState
          compact
          icon={EMPTY_SCHEDULE_ICON}
          title={t("convention.plan.empty.title")}
          subtitle={t("convention.plan.empty.body")}
          ctaLabel={t("convention.plan.empty.cta")}
          onCta={() => setView("all")}
        />
      )
    ) : null;

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
          onChangeText={(event) => {
            setSearchQuery(event.nativeEvent.text);
            if (event.nativeEvent.text.trim().length > 0) setView("all");
          }}
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
        {categories.length > 0 ? (
          <Stack.Toolbar.Menu
            icon={
              process.env.EXPO_OS === "ios"
                ? "line.3.horizontal.decrease"
                : FilterListIcon
            }
            accessibilityLabel={t("convention.filterEvents")}
            title={t("convention.categories")}
          >
            <Stack.Toolbar.MenuAction
              isOn={activeCategory === null}
              onPress={() => setBrowse({ category: null })}
            >
              {t("convention.allCategories")}
            </Stack.Toolbar.MenuAction>
            {categories.map((category) => (
              <Stack.Toolbar.MenuAction
                key={category}
                isOn={activeCategory === category}
                onPress={() => {
                  setBrowse({ category });
                  setView("all");
                }}
              >
                {category}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        ) : null}
      </Stack.Toolbar>
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
        // Bounce only when there is a schedule to show. Empty states must
        // not rubber-band, but the iOS large title needs a scrollable list
        // to lay itself into, so a populated list has to bounce.
        alwaysBounceVertical={shouldBounceSchedule(sections)}
        sections={sections}
        keyExtractor={(row) => row.id}
        // Rows close over values that are not part of `sections`, and
        // VirtualizedList reuses cached cells while the data identity holds.
        // The locale, clock preference, highlighted row, view and font scale
        // all change what a cached cell should show.
        extraData={`${locale}|${hour12}|${showProvenance}|${conventionTimeZone}|${highlightedEventId ?? ""}|${fontScale}|${view}|${Math.floor(now / 60_000)}`}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={
          sections.length === 0
            ? events.length === 0
              ? EMPTY_CONVENTION_CONTENT_STYLE
              : SCHEDULE_EMPTY_CONTENT_STYLE
            : SCHEDULE_LIST_CONTENT_STYLE
        }
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          events.length > 0 || scheduleRefresh.summary !== null
            ? listHeader
            : null
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={
          view === "all" && events.length > 0 ? (
            <Text variant="caption" className="px-4 pt-4 pb-2 text-center">
              {t("convention.browse.noSeat")}
            </Text>
          ) : null
        }
      />

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
