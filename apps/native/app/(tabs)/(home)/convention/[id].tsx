import EventIcon from "@expo/material-symbols/event.xml";
import UploadIcon from "@expo/material-symbols/upload.xml";
import { Icon } from "@expo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getCalendars } from "expo-localization";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  TextInput,
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

const SCHEDULE_VIEWS: { key: ScheduleView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My Schedule" },
  { key: "now-next", label: "Now & Next" },
];

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
        label: formatInConventionTime(
          event.startTime,
          timeZone,
          "EEEE, MMMM d",
        ),
        data: [event],
      });
    }
  }

  return groups.sort((a, b) => a.key.localeCompare(b.key));
}

function formatTime(isoString: string | null, timeZone: string): string {
  if (!isoString) return "";
  return formatInConventionTime(isoString, timeZone, "h:mm a");
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
  if (!event) return null;

  const room = event.room ?? event.location;
  const sourceUrl = event.sourceUrl;
  const scheduleAction = event.isInSchedule
    ? "Remove from Schedule"
    : "Add to Schedule";

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
              {formatInConventionTime(
                event.startTime,
                timeZone,
                "EEEE, MMMM d · h:mm a",
              )}
              {event.endTime
                ? ` to ${formatTime(event.endTime, timeZone)}`
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
              accessibilityHint="Updates this event in My Schedule"
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
                  ? "Change Reminder"
                  : "Set Reminder"
              }
              accessibilityHint="Opens reminder choices for this event"
              className="px-4 py-3.5 active:opacity-70"
            >
              <Text variant="body">
                {event.reminderMinutes !== null
                  ? "Change Reminder"
                  : "Set Reminder"}
              </Text>
            </Pressable>

            {sourceUrl && (
              <Pressable
                onPress={() => {
                  WebBrowser.openBrowserAsync(sourceUrl);
                  onClose();
                }}
                accessibilityRole="link"
                accessibilityLabel={`View ${event.title} on Sched`}
                accessibilityHint="Opens the event page in your browser"
                className="px-4 py-3.5 active:opacity-70"
              >
                <Text variant="body">View on Sched</Text>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close event details"
              className="px-4 py-3.5 active:opacity-70 mt-2 border-t border-border"
            >
              <Text
                variant="body"
                className="text-muted-foreground text-center"
              >
                Cancel
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

const REMINDER_OPTIONS = [
  { label: "No reminder", value: null },
  { label: "5 min before", value: 5 },
  { label: "15 min before", value: 15 },
  { label: "30 min before", value: 30 },
  { label: "1 hour before", value: 60 },
];

function ReminderPicker({
  event,
  visible,
  onClose,
  onSelect,
}: ReminderPickerProps) {
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
              Set Reminder
            </Text>
            {REMINDER_OPTIONS.map((opt) => (
              <Pressable
                key={String(opt.value)}
                onPress={() => {
                  onSelect(event, opt.value);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityLabel={opt.label}
                accessibilityState={{
                  checked: event.reminderMinutes === opt.value,
                }}
                className="px-4 py-3.5 active:opacity-70 flex-row items-center justify-between"
              >
                <Text variant="body">{opt.label}</Text>
                {event.reminderMinutes === opt.value && (
                  <Text className="text-primary">✓</Text>
                )}
              </Pressable>
            ))}
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
      setError("Title is required.");
      return;
    }

    const date = parseDate(values.date);
    if (!date) {
      setError("Date must use YYYY-MM-DD and be a real calendar date.");
      return;
    }

    const startParts = parseTime(values.startTime);
    if (!startParts) {
      setError("Start time must use 24-hour HH:mm, such as 09:30.");
      return;
    }

    const endValue = values.endTime.trim();
    const endParts = endValue ? parseTime(endValue) : null;
    if (endValue && !endParts) {
      setError("End time must use 24-hour HH:mm, such as 10:30.");
      return;
    }

    const start = fromConventionTime({ ...date, ...startParts }, timeZone);
    const normalizedStart = `${values.date.trim()} ${String(startParts.hour).padStart(2, "0")}:${String(startParts.minute).padStart(2, "0")}`;
    if (
      formatInConventionTime(start, timeZone, "yyyy-MM-dd HH:mm") !==
      normalizedStart
    ) {
      setError("That start time does not exist in the convention time zone.");
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
        setError("That end time does not exist in the convention time zone.");
        return;
      }
    }
    if (end && end.getTime() <= start.getTime()) {
      setError("End time must be later than start time on the same date.");
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
      setError("Could not save the event. Your other events were not changed.");
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
            accessibilityLabel="Cancel adding event"
            className="py-2 pr-3 active:opacity-70 disabled:opacity-50"
          >
            <Text className="text-primary">Cancel</Text>
          </Pressable>
          <Text variant="h3" accessibilityRole="header">
            Add Event
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save event"
            accessibilityState={{ disabled: saving, busy: saving }}
            className="py-2 pl-3 active:opacity-70 disabled:opacity-50"
          >
            <Text className="text-primary font-semibold">
              {saving ? "Saving…" : "Save"}
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
            <Text variant="label">Title *</Text>
            <TextInput
              value={values.title}
              onChangeText={(value) => updateValue("title", value)}
              placeholder="Event title"
              placeholderTextColor="#94A3B8"
              autoFocus
              accessibilityLabel="Event title, required"
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
          </View>

          <View className="gap-2">
            <Text variant="label">Date *</Text>
            <TextInput
              value={values.date}
              onChangeText={(value) => updateValue("date", value)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Event date, required, YYYY-MM-DD"
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <Text variant="label">Start *</Text>
              <TextInput
                value={values.startTime}
                onChangeText={(value) => updateValue("startTime", value)}
                placeholder="HH:mm"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Start time, required, 24-hour HH:mm"
                className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
              />
            </View>
            <View className="flex-1 gap-2">
              <Text variant="label">End</Text>
              <TextInput
                value={values.endTime}
                onChangeText={(value) => updateValue("endTime", value)}
                placeholder="HH:mm"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="End time, optional, 24-hour HH:mm"
                className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
              />
            </View>
          </View>

          <View className="gap-2">
            <Text variant="label">Room</Text>
            <TextInput
              value={values.room}
              onChangeText={(value) => updateValue("room", value)}
              placeholder="Optional"
              placeholderTextColor="#94A3B8"
              accessibilityLabel="Event room, optional"
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
          </View>

          <Text variant="caption" selectable>
            Date and times use {timeZone}. End time is on the same date.
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("all");
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

  const { data: convention, isLoading: conventionLoading } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsRepo.getByConventionId(id ?? ""),
    enabled: !!id,
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async (event: ConventionEvent) => {
      await eventsRepo.update(event.id, { isInSchedule: !event.isInSchedule });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: () => {
      Alert.alert(
        "Schedule Not Updated",
        "The event could not be changed. Your schedule was left as it was.",
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
    onSuccess: async () => {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["events", id] }),
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      ]);
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
          notificationId = await scheduleEventReminder(reminderEvent, minutes);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", id] });
    },
    onError: () => {
      Alert.alert(
        "Reminder Not Set",
        "Enable notifications in Settings and choose a future event.",
      );
    },
  });

  const scheduledEvents = events.filter((event) => event.isInSchedule);
  const conflictingEventIds = overlappingEventIds(scheduledEvents);

  const storedTimeZone = convention?.timeZone;
  const conventionTimeZone = isValidTimeZone(storedTimeZone)
    ? storedTimeZone
    : (getCalendars()[0]?.timeZone ?? "UTC");
  const listEvents = scheduleView === "mine" ? scheduledEvents : events;
  const categories = Array.from(
    new Set(
      listEvents.map((event) => event.category).filter(Boolean) as string[],
    ),
  );
  const activeCategory =
    selectedCategory && categories.includes(selectedCategory)
      ? selectedCategory
      : null;
  useEffect(() => {
    if (selectedCategory !== activeCategory) {
      setSelectedCategory(activeCategory);
    }
  }, [activeCategory, selectedCategory]);
  const filteredEvents = activeCategory
    ? listEvents.filter((event) => event.category === activeCategory)
    : listEvents;
  const dayGroups = groupEventsByDay(filteredEvents, conventionTimeZone);
  const nowAndNext = getNowAndNextEvents(scheduledEvents, new Date(now));
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

  if (!convention) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" className="text-muted-foreground text-center">
            Convention not found.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-4 active:opacity-70"
          >
            <Text className="text-primary">Go back</Text>
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
        startTime={formatTime(event.startTime, conventionTimeZone)}
        endTime={formatTime(event.endTime, conventionTimeZone)}
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

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: convention.name }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={
            process.env.EXPO_OS === "ios" ? "square.and.arrow.down" : UploadIcon
          }
          onPress={() => router.push(`/convention/${id}/import`)}
          accessibilityLabel="Import schedule"
          accessibilityHint="Opens file and Sched URL import options"
        >
          Import
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Text
        variant="caption"
        className="px-4 pt-2 pb-2 text-center text-muted-foreground"
      >
        Times shown in {conventionTimeZone}
      </Text>
      {conflictingEventIds.size > 0 ? (
        <Text
          variant="caption"
          className="px-4 pb-2 text-center text-destructive"
          accessibilityRole="alert"
        >
          {conflictingEventIds.size} selected event
          {conflictingEventIds.size === 1 ? "" : "s"} overlap
        </Text>
      ) : null}

      <View className="flex-row mx-4 mb-2 p-1 rounded-xl bg-card">
        {SCHEDULE_VIEWS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => {
              setScheduleView(key);
              setSelectedCategory(null);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Show ${label}`}
            accessibilityState={{ selected: scheduleView === key }}
            className={`flex-1 items-center px-2 py-2 rounded-lg active:opacity-70 ${scheduleView === key ? "bg-primary" : "bg-transparent"}`}
          >
            <Text
              variant="caption"
              className={
                scheduleView === key
                  ? "text-primary-foreground font-semibold"
                  : "text-muted-foreground"
              }
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => setManualEventVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Add event manually"
        accessibilityHint="Opens a form to save a local event"
        className="self-end flex-row items-center gap-1 px-4 py-2 active:opacity-70"
      >
        <Plus size={16} color="#0FACED" />
        <Text className="text-primary">Add event</Text>
      </Pressable>

      {/* Category filter pills */}
      {scheduleView !== "now-next" && categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 mb-2"
          contentContainerStyle={{ gap: 8 }}
        >
          <Pressable
            onPress={() => setSelectedCategory(null)}
            accessibilityRole="button"
            accessibilityLabel="Show all categories"
            accessibilityState={{ selected: activeCategory === null }}
            className={`px-3 py-1.5 rounded-full ${activeCategory === null ? "bg-primary" : "bg-card"}`}
          >
            <Text
              variant="caption"
              className={
                activeCategory === null
                  ? "text-primary-foreground"
                  : "text-muted-foreground"
              }
            >
              All
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() =>
                setSelectedCategory(activeCategory === cat ? null : cat)
              }
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${cat}`}
              accessibilityState={{ selected: activeCategory === cat }}
              className={`px-3 py-1.5 rounded-full ${activeCategory === cat ? "bg-primary" : "bg-card"}`}
            >
              <Text
                variant="caption"
                className={
                  activeCategory === cat
                    ? "text-primary-foreground"
                    : "text-muted-foreground"
                }
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Events list or empty state */}
      {scheduleView === "now-next" ? (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {scheduledEvents.length === 0 ? (
            <EmptyState
              icon={EMPTY_SCHEDULE_ICON}
              title={t("convention.myScheduleEmpty")}
              subtitle={t("convention.myScheduleNowNextSubtitle")}
              ctaLabel={t("convention.showAllEvents")}
              onCta={() => setScheduleView("all")}
            />
          ) : (
            <>
              <SectionHeader title={`Now (${nowAndNext.current.length})`} />
              {nowAndNext.current.length > 0 ? (
                nowAndNext.current.map(renderEventRow)
              ) : (
                <Text
                  variant="body"
                  className="px-4 py-4 text-muted-foreground"
                >
                  Nothing from My Schedule is happening right now.
                </Text>
              )}

              <SectionHeader
                title={
                  nowAndNext.next[0]
                    ? `Next · ${formatTime(nowAndNext.next[0].startTime, conventionTimeZone)} (${nowAndNext.next.length})`
                    : "Next (0)"
                }
              />
              {nowAndNext.next.length > 0 ? (
                nowAndNext.next.map(renderEventRow)
              ) : (
                <Text
                  variant="body"
                  className="px-4 py-4 text-muted-foreground"
                >
                  No more upcoming events in My Schedule.
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
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.label} />
          )}
          renderItem={({ item }) => renderEventRow(item)}
          ListEmptyComponent={
            scheduleView === "mine" ? (
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
                ctaLabel={t("convention.importSchedule")}
                onCta={() => router.push(`/convention/${id}/import`)}
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
