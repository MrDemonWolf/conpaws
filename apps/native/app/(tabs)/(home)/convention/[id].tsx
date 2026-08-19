import AddIcon from "@expo/material-symbols/add.xml";
import EventIcon from "@expo/material-symbols/event.xml";
import FilterListIcon from "@expo/material-symbols/filter_list.xml";
import UploadIcon from "@expo/material-symbols/upload.xml";
import { Icon } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getCalendars } from "expo-localization";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { EventItem } from "@/components/EventItem";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState, LoadingSpinner, SafeView, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import {
  conventionDayKey,
  formatInConventionTime,
  fromConventionTime,
  isValidTimeZone,
  overlappingEventIds,
} from "@/lib/convention-time";
import { getNowAndNextEvents } from "@/lib/schedule-view";
import {
  cancelEventReminder,
  scheduleEventReminder,
} from "@/services/notifications";

interface DayGroup {
  key: string;
  label: string;
  data: ConventionEvent[];
}

type ScheduleView = "all" | "mine" | "now-next";

const EMPTY_SCHEDULE_ICON = Icon.select({
  ios: "calendar",
  android: EventIcon,
});

interface ManualEventValues {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
}

interface ManualEventDraft {
  title: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
}

const EMPTY_MANUAL_EVENT: ManualEventValues = {
  title: "",
  date: "",
  startTime: "",
  endTime: "",
  room: "",
};

function parseDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    ? { hour, minute }
    : null;
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
        label: new Intl.DateTimeFormat(locale, {
          timeZone,
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date(event.startTime)),
        data: [event],
      });
    }
  }

  return groups.sort((a, b) => a.key.localeCompare(b.key));
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

interface ActionSheetProps {
  event: ConventionEvent | null;
  visible: boolean;
  timeZone: string;
  onClose: () => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  onSetReminder: (event: ConventionEvent) => void;
}

function EventActionSheet({
  event,
  visible,
  timeZone,
  onClose,
  onToggleSchedule,
  onSetReminder,
}: ActionSheetProps) {
  const { t, i18n } = useTranslation();
  if (!event) return null;

  const room = event.room ?? event.location;
  const sourceUrl = event.sourceUrl;
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const scheduleAction = event.isInSchedule
    ? t("convention.removeFromSchedule")
    : t("convention.addToSchedule");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessible={false}
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          className="bg-card rounded-t-2xl"
          style={{ maxHeight: "85%" }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View className="w-10 h-1 bg-border rounded-full self-center mt-3 mb-4" />
            <Text
              variant="h3"
              className="px-4"
              accessibilityRole="header"
              selectable
            >
              {event.title}
            </Text>
            <Text variant="caption" className="px-4 pt-1" selectable>
              {new Intl.DateTimeFormat(locale, {
                timeZone,
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(event.startTime))}
              {event.endTime
                ? ` ${t("convention.timeRangeTo", {
                    time: formatTime(event.endTime, timeZone, locale),
                  })}`
                : ""}
              {room ? ` · ${room}` : ""}
            </Text>
            {event.description ? (
              <Text
                variant="body"
                className="px-4 pt-3 pb-1 text-muted-foreground"
                selectable
              >
                {event.description}
              </Text>
            ) : null}

            <Pressable
              onPress={() => {
                onToggleSchedule(event);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={scheduleAction}
              accessibilityHint={t("convention.scheduleActionHint")}
              className="px-4 py-3.5 active:opacity-70"
            >
              <Text variant="body">{scheduleAction}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onSetReminder(event);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                event.reminderMinutes !== null
                  ? t("reminders.changeLeave")
                  : t("reminders.setLeave")
              }
              accessibilityHint={t("reminders.pickerDescription", {
                event: event.title,
              })}
              className="px-4 py-3.5 active:opacity-70"
            >
              <Text variant="body">
                {event.reminderMinutes !== null
                  ? t("reminders.changeLeave")
                  : t("reminders.setLeave")}
              </Text>
            </Pressable>

            {sourceUrl && (
              <Pressable
                onPress={() => {
                  WebBrowser.openBrowserAsync(sourceUrl);
                  onClose();
                }}
                accessibilityRole="link"
                accessibilityLabel={t("convention.viewOnSchedLabel", {
                  event: event.title,
                })}
                accessibilityHint={t("convention.openExternalHint")}
                className="px-4 py-3.5 active:opacity-70"
              >
                <Text variant="body">{t("convention.viewOnSched")}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("convention.closeEventDetails")}
              className="px-4 py-3.5 active:opacity-70 mt-2 border-t border-border"
            >
              <Text
                variant="body"
                className="text-muted-foreground text-center"
              >
                {t("common.cancel")}
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ReminderPickerProps {
  event: ConventionEvent | null;
  visible: boolean;
  onClose: () => void;
  onSelect: (event: ConventionEvent, minutes: number | null) => void;
}

const REMINDER_OPTIONS = [null, 5, 10, 15, 30, 60] as const;

function ReminderPicker({
  event,
  visible,
  onClose,
  onSelect,
}: ReminderPickerProps) {
  const { t } = useTranslation();
  if (!event) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessible={false}
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          className="bg-card rounded-t-2xl"
          style={{ maxHeight: "85%" }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View className="w-10 h-1 bg-border rounded-full self-center mt-3 mb-4" />
            <Text
              variant="label"
              className="px-4 pb-3"
              accessibilityRole="header"
            >
              {t("reminders.pickerTitle")}
            </Text>
            <Text variant="caption" className="px-4 pb-2">
              {t("reminders.pickerDescription", { event: event.title })}
            </Text>
            {REMINDER_OPTIONS.map((minutes) => {
              const label =
                minutes === null
                  ? t("reminders.none")
                  : minutes === 60
                    ? t("reminders.hourBefore")
                    : t("reminders.minutesBefore", { minutes });
              return (
                <Pressable
                  key={String(minutes)}
                  onPress={() => {
                    onSelect(event, minutes);
                    onClose();
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{
                    checked: event.reminderMinutes === minutes,
                  }}
                  className="px-4 py-3.5 active:opacity-70 flex-row items-center justify-between"
                >
                  <Text variant="body">{label}</Text>
                  {event.reminderMinutes === minutes && (
                    <Text className="text-primary">✓</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ManualEventModalProps {
  visible: boolean;
  defaultDate: string;
  timeZone: string;
  onClose: () => void;
  onSave: (event: ManualEventDraft) => Promise<void>;
}

function ManualEventModal({
  visible,
  defaultDate,
  timeZone,
  onClose,
  onSave,
}: ManualEventModalProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [values, setValues] = useState<ManualEventValues>(EMPTY_MANUAL_EVENT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setValues({ ...EMPTY_MANUAL_EVENT, date: defaultDate });
    setError(null);
  }, [defaultDate, visible]);

  function updateValue(key: keyof ManualEventValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    const title = values.title.trim();
    if (!title) {
      setError(t("convention.manualEvent.errors.title"));
      return;
    }

    const date = parseDate(values.date);
    if (!date) {
      setError(t("convention.manualEvent.errors.date"));
      return;
    }

    const startParts = parseTime(values.startTime);
    if (!startParts) {
      setError(t("convention.manualEvent.errors.startTime"));
      return;
    }

    const endValue = values.endTime.trim();
    const endParts = endValue ? parseTime(endValue) : null;
    if (endValue && !endParts) {
      setError(t("convention.manualEvent.errors.endTime"));
      return;
    }

    const start = fromConventionTime({ ...date, ...startParts }, timeZone);
    const normalizedStart = `${values.date.trim()} ${String(startParts.hour).padStart(2, "0")}:${String(startParts.minute).padStart(2, "0")}`;
    if (
      formatInConventionTime(start, timeZone, "yyyy-MM-dd HH:mm") !==
      normalizedStart
    ) {
      setError(t("convention.manualEvent.errors.startTimeZone"));
      return;
    }

    const end = endParts
      ? fromConventionTime({ ...date, ...endParts }, timeZone)
      : null;
    if (end && endParts) {
      const normalizedEnd = `${values.date.trim()} ${String(endParts.hour).padStart(2, "0")}:${String(endParts.minute).padStart(2, "0")}`;
      if (
        formatInConventionTime(end, timeZone, "yyyy-MM-dd HH:mm") !==
        normalizedEnd
      ) {
        setError(t("convention.manualEvent.errors.endTimeZone"));
        return;
      }
    }
    if (end && end.getTime() <= start.getTime()) {
      setError(t("convention.manualEvent.errors.order"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        title,
        startTime: start.toISOString(),
        endTime: end?.toISOString() ?? null,
        room: values.room.trim() || null,
      });
      onClose();
    } catch {
      setError(t("convention.manualEvent.errors.save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={saving ? undefined : onClose}
    >
      <SafeView>
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable
            onPress={onClose}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("convention.manualEvent.cancelLabel")}
            className="min-h-11 min-w-11 justify-center pr-3 active:opacity-70 disabled:opacity-50"
          >
            <Text className="text-primary">{t("common.cancel")}</Text>
          </Pressable>
          <Text variant="h3" accessibilityRole="header">
            {t("convention.addEvent")}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("convention.manualEvent.saveLabel")}
            accessibilityState={{ disabled: saving, busy: saving }}
            className="min-h-11 min-w-11 justify-center pl-3 active:opacity-70 disabled:opacity-50"
          >
            <Text className="text-primary font-semibold">
              {saving ? t("convention.manualEvent.saving") : t("common.save")}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 16 }}
        >
          <View className="gap-2">
            <Text variant="label">
              {t("convention.manualEvent.titleLabel")}
            </Text>
            <TextInput
              value={values.title}
              onChangeText={(value) => updateValue("title", value)}
              placeholder={t("convention.manualEvent.titlePlaceholder")}
              placeholderTextColor="#94A3B8"
              autoFocus
              accessibilityLabel={t(
                "convention.manualEvent.titleAccessibility",
              )}
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
          </View>

          <View className="gap-2">
            <Text variant="label">{t("convention.manualEvent.dateLabel")}</Text>
            <TextInput
              value={values.date}
              onChangeText={(value) => updateValue("date", value)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel={t("convention.manualEvent.dateAccessibility")}
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
          </View>

          <View className={fontScale > 1.3 ? "gap-3" : "flex-row gap-3"}>
            <View className={fontScale > 1.3 ? "gap-2" : "flex-1 gap-2"}>
              <Text variant="label">
                {t("convention.manualEvent.startLabel")}
              </Text>
              <TextInput
                value={values.startTime}
                onChangeText={(value) => updateValue("startTime", value)}
                placeholder="HH:mm"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                accessibilityLabel={t(
                  "convention.manualEvent.startAccessibility",
                )}
                className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
              />
            </View>
            <View className={fontScale > 1.3 ? "gap-2" : "flex-1 gap-2"}>
              <Text variant="label">
                {t("convention.manualEvent.endLabel")}
              </Text>
              <TextInput
                value={values.endTime}
                onChangeText={(value) => updateValue("endTime", value)}
                placeholder="HH:mm"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                accessibilityLabel={t(
                  "convention.manualEvent.endAccessibility",
                )}
                className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
              />
            </View>
          </View>

          <View className="gap-2">
            <Text variant="label">{t("convention.manualEvent.roomLabel")}</Text>
            <TextInput
              value={values.room}
              onChangeText={(value) => updateValue("room", value)}
              placeholder={t("convention.manualEvent.roomPlaceholder")}
              placeholderTextColor="#94A3B8"
              accessibilityLabel={t("convention.manualEvent.roomAccessibility")}
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
          </View>

          <Text variant="caption" selectable>
            {t("convention.manualEvent.timeZoneHelp", { timeZone })}
          </Text>
          {error ? (
            <Text
              variant="body"
              className="text-destructive"
              accessibilityRole="alert"
              selectable
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </SafeView>
    </Modal>
  );
}

export default function ConventionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualEventVisible, setManualEventVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [actionSheetEvent, setActionSheetEvent] =
    useState<ConventionEvent | null>(null);
  const [reminderEvent, setReminderEvent] = useState<ConventionEvent | null>(
    null,
  );

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
    data: events = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsRepo.getByConventionId(id ?? ""),
    enabled: !!id,
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async (event: ConventionEvent) => {
      await eventsRepo.update(event.id, { isInSchedule: !event.isInSchedule });
    },
    onSuccess: (_, event) => {
      queryClient.invalidateQueries({ queryKey: ["events", id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["events", id] }),
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      ]);
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
          await eventsRepo.update(event.id, { reminderMinutes: null });
          throw new Error("The operating system rejected the reminder");
        }
        if (!notificationId) {
          await eventsRepo.update(event.id, { reminderMinutes: null });
          throw new Error(
            "Reminder permission denied or event already started",
          );
        }

        try {
          await eventsRepo.update(event.id, { reminderMinutes: minutes });
        } catch (error) {
          await cancelEventReminder(event.id);
          if (event.reminderMinutes !== null) {
            try {
              await scheduleEventReminder(reminderEvent, event.reminderMinutes);
            } catch {
              // Best-effort rollback after a database failure.
            }
          }
          throw error;
        }
      } else {
        if (!(await cancelEventReminder(event.id))) {
          throw new Error("The operating system could not cancel the reminder");
        }
        try {
          await eventsRepo.update(event.id, { reminderMinutes: null });
        } catch (error) {
          if (event.reminderMinutes !== null) {
            try {
              await scheduleEventReminder(reminderEvent, event.reminderMinutes);
            } catch {
              // Best-effort rollback after a database failure.
            }
          }
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
    onError: () => {
      Alert.alert(t("reminders.errorTitle"), t("reminders.errorMessage"));
    },
  });

  const scheduledEvents = events.filter((event) => event.isInSchedule);
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

  const isLoading = conventionLoading || eventsLoading;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner />
        </View>
      </View>
    );
  }

  if (conventionError || eventsError) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon={EMPTY_SCHEDULE_ICON}
          title={t("common.error")}
          ctaLabel={t("common.retry")}
          onCta={() => {
            void Promise.all([refetchConvention(), refetchEvents()]);
          }}
        />
      </View>
    );
  }

  if (!convention) {
    return (
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
    );
  }

  function renderEventRow(event: ConventionEvent) {
    return (
      <EventItem
        key={event.id}
        title={event.title}
        startTime={formatTime(event.startTime, conventionTimeZone, locale)}
        endTime={formatTime(event.endTime, conventionTimeZone, locale)}
        room={event.room ?? event.location ?? undefined}
        category={event.category ?? undefined}
        isInSchedule={event.isInSchedule}
        hasReminder={event.reminderMinutes !== null}
        hasConflict={conflictingEventIds.has(event.id)}
        isAgeRestricted={event.isAgeRestricted}
        contentWarning={event.contentWarning}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setActionSheetEvent(event);
        }}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setActionSheetEvent(event);
        }}
      />
    );
  }

  const scheduleNotices = (
    <View className="pb-1">
      <Text variant="caption" className="px-4 pt-1 pb-2 text-muted-foreground">
        {t("convention.timesShownIn", { timeZone: conventionTimeZone })}
      </Text>
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
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: convention.name,
          headerLargeTitle: true,
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
      {events.length > 0 ? (
        <Stack.Toolbar placement="right">
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
              onPress={() => router.push(`/convention/${id}/import`)}
            >
              {t("convention.importSchedule")}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
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
      ) : null}
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
                        time: formatTime(
                          nowAndNext.next[0].startTime,
                          conventionTimeZone,
                          locale,
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
          sections={dayGroups}
          keyExtractor={(event) => event.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={
            dayGroups.length === 0 ? { flexGrow: 1 } : undefined
          }
          ListHeaderComponent={events.length > 0 ? scheduleNotices : null}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.label} />
          )}
          renderItem={({ item }) => renderEventRow(item)}
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
              <EmptyState
                icon={EMPTY_SCHEDULE_ICON}
                title={t("convention.noEvents")}
                subtitle={t("convention.noEventsSubtitle")}
                ctaLabel={t("convention.addEvent")}
                onCta={() => setManualEventVisible(true)}
                secondaryCtaLabel={t("convention.importSchedule")}
                onSecondaryCta={() => router.push(`/convention/${id}/import`)}
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
        onClose={() => setActionSheetEvent(null)}
        onToggleSchedule={(event) => toggleScheduleMutation.mutate(event)}
        onSetReminder={(event) => setReminderEvent(event)}
      />

      {/* Reminder Picker */}
      <ReminderPicker
        event={reminderEvent}
        visible={reminderEvent !== null}
        onClose={() => setReminderEvent(null)}
        onSelect={(event, minutes) =>
          setReminderMutation.mutate({ event, minutes })
        }
      />

      <ManualEventModal
        visible={manualEventVisible}
        defaultDate={manualEventDefaultDate}
        timeZone={conventionTimeZone}
        onClose={() => setManualEventVisible(false)}
        onSave={(event) => addManualEventMutation.mutateAsync(event)}
      />
    </View>
  );
}
