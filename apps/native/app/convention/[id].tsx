import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { getCalendars } from "expo-localization";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, MoreHorizontal, Plus, Upload } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { CategoryPill } from "@/components/CategoryPill";
import { EventItem } from "@/components/EventItem";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState, LoadingSpinner, SafeView, Text } from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import {
  conventionDayKey,
  formatInConventionTime,
  isValidTimeZone,
} from "@/lib/convention-time";
import {
  cancelEventReminder,
  scheduleEventReminder,
} from "@/services/notifications";

interface DayGroup {
  key: string;
  label: string;
  events: ConventionEvent[];
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
      existing.events.push(event);
    } else {
      groups.push({
        key,
        label: formatInConventionTime(
          event.startTime,
          timeZone,
          "EEEE, MMMM d",
        ),
        events: [event],
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
  onClose: () => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  onSetReminder: (event: ConventionEvent) => void;
}

function EventActionSheet({
  event,
  visible,
  onClose,
  onToggleSchedule,
  onSetReminder,
}: ActionSheetProps) {
  if (!event) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable className="bg-card rounded-t-2xl pb-8">
          <View className="w-10 h-1 bg-border rounded-full self-center mt-3 mb-4" />
          <Text
            variant="label"
            className="px-4 pb-3 text-muted-foreground"
            numberOfLines={1}
          >
            {event.title}
          </Text>

          {/* Toggle schedule */}
          <Pressable
            onPress={() => {
              onToggleSchedule(event);
              onClose();
            }}
            className="px-4 py-3.5 active:opacity-70"
          >
            <Text variant="body">
              {event.isInSchedule ? "Remove from Schedule" : "Add to Schedule"}
            </Text>
          </Pressable>

          {/* Set reminder */}
          <Pressable
            onPress={() => {
              onSetReminder(event);
              onClose();
            }}
            className="px-4 py-3.5 active:opacity-70"
          >
            <Text variant="body">
              {event.reminderMinutes !== null
                ? "Change Reminder"
                : "Set Reminder"}
            </Text>
          </Pressable>

          {/* View on Sched */}
          {event.sourceUrl && (
            <Pressable
              onPress={() => {
                Linking.openURL(event.sourceUrl!);
                onClose();
              }}
              className="px-4 py-3.5 active:opacity-70"
            >
              <Text variant="body">View on Sched</Text>
            </Pressable>
          )}

          {/* Cancel */}
          <Pressable
            onPress={onClose}
            className="px-4 py-3.5 active:opacity-70 mt-2 border-t border-border"
          >
            <Text variant="body" className="text-muted-foreground text-center">
              Cancel
            </Text>
          </Pressable>
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
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable className="bg-card rounded-t-2xl pb-8">
          <View className="w-10 h-1 bg-border rounded-full self-center mt-3 mb-4" />
          <Text variant="label" className="px-4 pb-3">
            Set Reminder
          </Text>
          {REMINDER_OPTIONS.map((opt) => (
            <Pressable
              key={String(opt.value)}
              onPress={() => {
                onSelect(event, opt.value);
                onClose();
              }}
              className="px-4 py-3.5 active:opacity-70 flex-row items-center justify-between"
            >
              <Text variant="body">{opt.label}</Text>
              {event.reminderMinutes === opt.value && (
                <Text className="text-primary">✓</Text>
              )}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ConventionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [actionSheetEvent, setActionSheetEvent] =
    useState<ConventionEvent | null>(null);
  const [reminderEvent, setReminderEvent] = useState<ConventionEvent | null>(
    null,
  );

  const { data: convention, isLoading: conventionLoading } = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id!),
    enabled: !!id,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["events", id],
    queryFn: () => eventsRepo.getByConventionId(id!),
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

  const categories = Array.from(
    new Set(events.map((e) => e.category).filter(Boolean) as string[]),
  );

  const filteredEvents = selectedCategory
    ? events.filter((e) => e.category === selectedCategory)
    : events;

  const storedTimeZone = convention?.timeZone;
  const conventionTimeZone = isValidTimeZone(storedTimeZone)
    ? storedTimeZone
    : (getCalendars()[0]?.timeZone ?? "UTC");
  const dayGroups = groupEventsByDay(filteredEvents, conventionTimeZone);

  const isLoading = conventionLoading || eventsLoading;

  if (isLoading) {
    return (
      <SafeView>
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner />
        </View>
      </SafeView>
    );
  }

  if (!convention) {
    return (
      <SafeView>
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
      </SafeView>
    );
  }

  return (
    <SafeView>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className="active:opacity-70"
        >
          <ChevronLeft size={24} color="#94A3B8" />
        </Pressable>
        <Text variant="h3" className="flex-1 mx-3" numberOfLines={1}>
          {convention.name}
        </Text>
        <Pressable
          onPress={() => router.push(`/convention/${id}/import`)}
          className="active:opacity-70"
        >
          <Upload size={20} color="#94A3B8" />
        </Pressable>
      </View>
      <Text
        variant="caption"
        className="px-4 pb-2 text-center text-muted-foreground"
      >
        Times shown in {conventionTimeZone}
      </Text>

      {/* Category filter pills */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 mb-2"
          contentContainerStyle={{ gap: 8 }}
        >
          <Pressable
            onPress={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full ${selectedCategory === null ? "bg-primary" : "bg-card"}`}
          >
            <Text
              variant="caption"
              className={
                selectedCategory === null
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
                setSelectedCategory(selectedCategory === cat ? null : cat)
              }
              className={`px-3 py-1.5 rounded-full ${selectedCategory === cat ? "bg-primary" : "bg-card"}`}
            >
              <Text
                variant="caption"
                className={
                  selectedCategory === cat
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
      {events.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6 gap-6">
          <EmptyState
            icon={<Text className="text-5xl">📅</Text>}
            title={t("convention.noEvents")}
            subtitle={t("convention.noEventsSubtitle")}
            ctaLabel={t("convention.importSchedule")}
            onCta={() => router.push(`/convention/${id}/import`)}
          />
          <Pressable onPress={() => {}} className="active:opacity-70">
            <Text className="text-primary text-center">
              + Add event manually
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={dayGroups}
          keyExtractor={(item) => item.key}
          renderItem={({ item: group }) => (
            <View>
              <SectionHeader title={group.label} />
              {group.events.map((event) => (
                <EventItem
                  key={event.id}
                  title={event.title}
                  startTime={formatTime(event.startTime, conventionTimeZone)}
                  endTime={formatTime(event.endTime, conventionTimeZone)}
                  room={event.room ?? event.location ?? undefined}
                  category={event.category ?? undefined}
                  isInSchedule={event.isInSchedule}
                  hasReminder={event.reminderMinutes !== null}
                  isAgeRestricted={event.isAgeRestricted}
                  contentWarning={event.contentWarning}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setActionSheetEvent(event);
                  }}
                />
              ))}
            </View>
          )}
        />
      )}

      {/* Action Sheet */}
      <EventActionSheet
        event={actionSheetEvent}
        visible={actionSheetEvent !== null}
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
    </SafeView>
  );
}
