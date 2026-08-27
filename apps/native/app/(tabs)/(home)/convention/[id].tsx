import AddIcon from "@expo/material-symbols/add.xml";
import EventIcon from "@expo/material-symbols/event.xml";
import FilterListIcon from "@expo/material-symbols/filter_list.xml";
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
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  SectionList,
  View,
} from "react-native";
import {
  BlankConventionState,
  EMPTY_SCHEDULE_ICON,
} from "@/components/convention-detail/BlankConventionState";
import { ConventionEventRow } from "@/components/convention-detail/ConventionEventRow";
import { EventActionSheet } from "@/components/convention-detail/EventActionSheet";
import {
  type ManualEventDraft,
  ManualEventModal,
} from "@/components/convention-detail/ManualEventModal";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState, SafeView, ScheduleSkeleton, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import {
  conventionDayKey,
  isValidTimeZone,
  overlappingEventIds,
} from "@/lib/convention-time";
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
  SCHEDULE_EMPTY_CONTENT_STYLE,
  SCHEDULE_LIST_CONTENT_STYLE,
} from "@/lib/schedule-list-styles";
import { getNowAndNextEvents } from "@/lib/schedule-view";
import { hapticSuccess, hapticToggle } from "@/services/haptics";
import {
  cancelEventReminder,
  getNotificationPermissionStatus,
  type PermissionStatus,
  scheduleEventReminder,
} from "@/services/notifications";

interface DayGroup {
  key: string;
  label: string;
  data: ConventionEvent[];
}

type ScheduleView = "all" | "mine" | "now-next";

const EMPTY_CONVENTION_CONTENT_STYLE = {
  flexGrow: 1,
  justifyContent: "center",
  paddingBottom: 48,
  paddingTop: 24,
} as const;

/** Why a reminder could not be set, so each cause gets its own message. */
type ReminderFailure = "permission" | "too-late" | "cancel-failed" | "unknown";

class ReminderError extends Error {
  readonly failure: ReminderFailure;

  constructor(failure: ReminderFailure) {
    super(failure);
    this.failure = failure;
  }
}

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
        data: [event],
      });
    }
  }

  return groups.sort((a, b) => a.key.localeCompare(b.key));
}

export default function ConventionDetailScreen() {
  const { id, previewState: requestedPreviewState } = useLocalSearchParams<{
    id: string;
    previewState?: string;
  }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const locale = currentLocale();
  const hour12 = deviceHour12();
  const previewState = resolveConventionPreviewState(
    requestedPreviewState,
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );
  const presentationLock = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualEventVisible, setManualEventVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [notificationPermission, setNotificationPermission] =
    useState<PermissionStatus | null>(null);
  const [actionSheetEvent, setActionSheetEvent] =
    useState<ConventionEvent | null>(null);

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
    }, []),
  );

  // Re-read on every focus and on every return to the foreground: turning
  // notifications back on happens in the OS settings app, which does not
  // re-mount this screen.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      function readPermission() {
        void getNotificationPermissionStatus()
          .then((status) => {
            if (active) setNotificationPermission(status);
          })
          .catch(() => undefined);
      }

      readPermission();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") readPermission();
      });
      return () => {
        active = false;
        subscription.remove();
      };
    }, []),
  );

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

  const toggleScheduleMutation = useMutation({
    mutationFn: async (event: ConventionEvent) => {
      const isInSchedule = !event.isInSchedule;
      if (isInSchedule || event.reminderMinutes === null) {
        await eventsRepo.update(event.id, { isInSchedule });
        return;
      }

      // An event taken off the schedule keeps no reminder: leaving one armed
      // fires a "time to leave" notification for a panel the user has already
      // dropped, and the row no longer shows a badge that would explain it.
      await cancelEventReminder(event.id);
      await eventsRepo.update(event.id, {
        isInSchedule,
        reminderMinutes: null,
      });
    },
    onSuccess: (_, event) => {
      queryClient.invalidateQueries({ queryKey: ["events", id] });
      // `isInSchedule` is the state before the toggle, so the new state is its negation.
      hapticToggle(!event.isInSchedule);
      AccessibilityInfo.announceForAccessibility(
        t(
          event.isInSchedule
            ? "convention.scheduleRemovedAnnouncement"
            : "convention.scheduleAddedAnnouncement",
          { event: event.title },
        ),
      );
    },
    onError: () => {
      Alert.alert(
        t("convention.scheduleUpdateErrorTitle"),
        t("convention.scheduleUpdateErrorMessage"),
      );
    },
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

  const setReminderMutation = useMutation({
    mutationFn: async ({
      event,
      minutes,
    }: {
      event: ConventionEvent;
      minutes: number | null;
    }) => {
      const reminderEvent = {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        room: event.room ?? event.location,
      };

      /**
       * `scheduleEventReminder` drops the request the OS is already holding
       * before it tries the new one, so a rejected change leaves the reminder
       * the user still has saved with nothing behind it. Putting it back is
       * what keeps the row and the OS agreeing.
       */
      async function restorePreviousReminder() {
        if (event.reminderMinutes === null) return;
        try {
          await scheduleEventReminder(reminderEvent, event.reminderMinutes, {
            requestPermission: false,
          });
        } catch {
          // Best effort: the next launch reconciles what is left.
        }
      }

      if (minutes !== null && event.startTime) {
        let notificationId: string | null = null;
        try {
          notificationId = await scheduleEventReminder(reminderEvent, minutes, {
            notificationContent: {
              title: t("reminders.notificationTitle", { event: event.title }),
              body: t(
                reminderEvent.room
                  ? "reminders.notificationBodyWithRoom"
                  : "reminders.notificationBody",
                { minutes, room: reminderEvent.room },
              ),
            },
          });
        } catch {
          // `reminderMinutes` is the only record that the user ever asked for
          // a reminder. A failed attempt at a new lead time must not wipe the
          // one they already had, so the row is left exactly as it was.
          await restorePreviousReminder();
          throw new ReminderError("unknown");
        }
        if (!notificationId) {
          // Two very different causes, and the OS reports both the same way.
          const permission = await getNotificationPermissionStatus();
          if (permission === "granted") await restorePreviousReminder();
          throw new ReminderError(
            permission === "granted" ? "too-late" : "permission",
          );
        }

        try {
          await eventsRepo.update(event.id, { reminderMinutes: minutes });
        } catch (error) {
          await cancelEventReminder(event.id);
          await restorePreviousReminder();
          throw error;
        }
      } else {
        if (!(await cancelEventReminder(event.id))) {
          throw new ReminderError("cancel-failed");
        }
        try {
          await eventsRepo.update(event.id, { reminderMinutes: null });
        } catch (error) {
          await restorePreviousReminder();
          throw error;
        }
      }
    },
    onSuccess: (_, { event, minutes }) => {
      queryClient.invalidateQueries({ queryKey: ["events", id] });
      AccessibilityInfo.announceForAccessibility(
        t(
          minutes === null
            ? "reminders.clearedAnnouncement"
            : "reminders.setAnnouncement",
          { event: event.title, minutes },
        ),
      );
    },
    onError: (error) => {
      const failure =
        error instanceof ReminderError ? error.failure : "unknown";

      if (failure === "permission") {
        setNotificationPermission("denied");
        Alert.alert(
          t("reminders.permissionTitle"),
          t("reminders.permissionMessage"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("reminders.openSettings"),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return;
      }

      Alert.alert(
        t(
          failure === "too-late"
            ? "reminders.tooLateTitle"
            : "reminders.errorTitle",
        ),
        t(
          failure === "too-late"
            ? "reminders.tooLateMessage"
            : "reminders.errorMessage",
        ),
      );
    },
  });

  const openEventActions = useCallback((event: ConventionEvent) => {
    setActionSheetEvent(event);
  }, []);

  const scheduledEvents = events.filter((event) => event.isInSchedule);
  // One computation per render, not per row.
  const showProvenance = useMemo(() => shouldShowProvenance(events), [events]);
  const conflictingEventIds = overlappingEventIds(scheduledEvents);

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
  const nowAndNext = getNowAndNextEvents(filteredEvents, new Date(now));
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

  const renderItem = useCallback(
    ({ item }: { item: ConventionEvent }) => (
      <ConventionEventRow
        event={item}
        timeZone={conventionTimeZone}
        locale={locale}
        hour12={hour12}
        showProvenance={showProvenance}
        hasConflict={conflictingEventIds.has(item.id)}
        onSelect={openEventActions}
      />
    ),
    [
      conflictingEventIds,
      conventionTimeZone,
      hour12,
      locale,
      openEventActions,
      showProvenance,
    ],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { label: string } }) => (
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
          <View className="flex-1 items-center justify-center px-6">
            <Text variant="body" className="text-muted-foreground text-center">
              {t("convention.notFound")}
            </Text>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              className="mt-4 min-h-11 justify-center active:opacity-70"
            >
              <Text className="text-primary">{t("convention.goBack")}</Text>
            </Pressable>
          </View>
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
      <ConventionEventRow
        key={event.id}
        event={event}
        timeZone={conventionTimeZone}
        locale={locale}
        hour12={hour12}
        showProvenance={showProvenance}
        hasConflict={conflictingEventIds.has(event.id)}
        onSelect={openEventActions}
      />
    );
  }

  const scheduleNotices = (
    <View className="pb-1">
      <Text variant="caption" className="px-4 pt-1 pb-2 text-muted-foreground">
        {t("convention.timesShownIn", { timeZone: conventionTimeZone })}
      </Text>
      {reminderNotice !== "none" ? (
        <View className="mx-4 mb-2 rounded-xl bg-secondary px-3 py-2">
          <Text variant="label" accessibilityRole="alert">
            {t(
              reminderNotice === "permission"
                ? "reminders.pausedTitle"
                : "reminders.overflowTitle",
            )}
          </Text>
          <Text variant="caption" className="pt-0.5 text-muted-foreground">
            {t(
              reminderNotice === "permission"
                ? "reminders.pausedMessage"
                : "reminders.overflowMessage",
              { count: reminderOverflow },
            )}
          </Text>
          {reminderNotice === "permission" ? (
            <Pressable
              onPress={() => {
                void Linking.openSettings();
              }}
              accessibilityRole="button"
              accessibilityLabel={t("reminders.openSettings")}
              className="min-h-11 justify-center active:opacity-70"
            >
              <Text className="text-primary">
                {t("reminders.openSettings")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {conflictingEventIds.size > 0 ? (
        <View className="mx-4 mb-2 rounded-xl bg-secondary px-3 py-2">
          <Text variant="label" accessibilityRole="alert">
            {t("convention.overlapSummary", {
              count: conflictingEventIds.size,
            })}
          </Text>
          <Text variant="caption" className="pt-0.5 text-muted-foreground">
            {t("convention.overlapHelp")}
          </Text>
        </View>
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
          onPress={() => router.push(`/convention/${convention.id}/edit`)}
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
          alwaysBounceVertical={dayGroups.length > 0}
          sections={dayGroups}
          keyExtractor={(event) => event.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={
            dayGroups.length === 0
              ? events.length === 0
                ? EMPTY_CONVENTION_CONTENT_STYLE
                : SCHEDULE_EMPTY_CONTENT_STYLE
              : SCHEDULE_LIST_CONTENT_STYLE
          }
          ListHeaderComponent={dayGroups.length > 0 ? scheduleNotices : null}
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

      {/* Action Sheet */}
      <EventActionSheet
        event={actionSheetEvent}
        visible={actionSheetEvent !== null}
        timeZone={conventionTimeZone}
        hour12={hour12}
        onClose={() => setActionSheetEvent(null)}
        onToggleSchedule={(event) => toggleScheduleMutation.mutate(event)}
        onSelectReminder={(event, minutes) =>
          setReminderMutation.mutate({ event, minutes })
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
