import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { getEventIndicatorLabels } from "@/components/convention-detail/ConventionEventRow";
import { Badge, Text } from "@/components/ui";
import type { ConventionEvent } from "@/db/schema";
import {
  formatEventEndDateTime,
  scheduleFormatter,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import { getCachedDefaultReminderMinutes } from "@/lib/reminder-default-storage";

/**
 * Content of the event sheet. This used to be a hand-rolled RN `Modal` with
 * `animationType="fade"`; it is now rendered inside a pushed `formSheet` route
 * (`/convention/[id]/event/[eventId]`), so the system owns presentation,
 * drag-to-dismiss, the grabber, and VoiceOver's modal containment/escape —
 * everything the Modal version faked or lacked. It also kills two real bugs by
 * construction: the Modal was unmounted mid-dismiss (`event` and `visible`
 * were the same state variable), and two of its rows bypassed the close path
 * that reset `mode`, leaking the reminder picker into the next opening. Route
 * state dies with the route, so neither can recur.
 */
interface EventSheetContentProps {
  event: ConventionEvent;
  timeZone: string;
  hour12?: boolean;
  /** Dismiss the sheet; every action row calls this after acting. */
  onClose: () => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  onSelectReminder: (event: ConventionEvent, minutes: number | null) => void;
}

export function EventSheetContent({
  event,
  timeZone,
  hour12,
  onClose,
  onToggleSchedule,
  onSelectReminder,
}: EventSheetContentProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"actions" | "reminder">("actions");

  const room = event.room ?? event.location;
  const locale = currentLocale();
  const { provenanceLabel, reminderLabel } = getEventIndicatorLabels(event, t);
  const scheduleAction = event.isInSchedule
    ? t("convention.removeFromSchedule")
    : t("convention.addToSchedule");

  if (mode === "reminder") {
    return (
      <View testID="convention-reminder-picker" className="bg-card">
        <ReminderPickerContent
          event={event}
          onClose={onClose}
          onBack={() => setMode("actions")}
          onSelect={onSelectReminder}
        />
      </View>
    );
  }

  return (
    // Plain views, no ScrollView: the formSheet's fitToContents detent can
    // only measure natural height, and a ScrollView reports its viewport, not
    // its content. Everything here fits without scrolling; the description is
    // clamped to keep that true for long ICS blurbs.
    <View testID="convention-event-actions" className="bg-card pt-4 pb-8">
      <Text variant="h3" className="px-4" accessibilityRole="header" selectable>
        {event.title}
      </Text>
      <Text variant="caption" className="px-4 pt-1" selectable>
        {scheduleFormatter("dateAndTime", locale, timeZone, hour12).format(
          new Date(event.startTime),
        )}
        {event.endTime
          ? ` ${t("convention.timeRangeTo", {
              time: formatEventEndDateTime(
                event.startTime,
                event.endTime,
                timeZone,
                locale,
                hour12,
              ),
            })}`
          : ""}
        {room ? ` · ${room}` : ""}
      </Text>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={[
          reminderLabel
            ? `${t("convention.reminderSet")}: ${reminderLabel}`
            : null,
          provenanceLabel,
        ]
          .filter(Boolean)
          .join(", ")}
        className="flex-row flex-wrap gap-1.5 px-4 pt-3"
      >
        {reminderLabel !== undefined ? (
          <Badge variant="info" label={reminderLabel} />
        ) : null}
        <Badge variant="neutral" label={provenanceLabel} />
      </View>
      {event.description ? (
        <Text
          variant="body"
          className="px-4 pt-3 pb-1 text-muted-foreground"
          numberOfLines={4}
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
        onPress={() => setMode("reminder")}
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

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("convention.closeEventDetails")}
        className="px-4 py-3.5 active:opacity-70 mt-2 border-t border-border"
      >
        <Text variant="body" className="text-muted-foreground text-center">
          {t("common.cancel")}
        </Text>
      </Pressable>
    </View>
  );
}

interface ReminderPickerContentProps {
  event: ConventionEvent;
  onClose: () => void;
  /** Return to the actions list without dismissing the sheet. */
  onBack: () => void;
  onSelect: (event: ConventionEvent, minutes: number | null) => void;
}

/**
 * `0` is "At event time" — the string existed in all eight locales but was
 * never offered because 0 was missing here; the scheduler already handles a
 * zero lead time (it only rejects triggers that are in the past).
 */
const REMINDER_OPTIONS = [null, 0, 5, 10, 15, 30, 60] as const;

function ReminderPickerContent({
  event,
  onClose,
  onBack,
  onSelect,
}: ReminderPickerContentProps) {
  const { t } = useTranslation();
  // For an event with no reminder yet, pre-check the default from Settings so
  // the common case is one tap on the already-suggested row. An event with a
  // reminder always shows its own value.
  const checkedMinutes =
    event.reminderMinutes !== null
      ? event.reminderMinutes
      : getCachedDefaultReminderMinutes();

  return (
    <View className="pt-4 pb-8">
      <Text variant="label" className="px-4 pb-3" accessibilityRole="header">
        {t("reminders.pickerTitle")}
      </Text>
      <Text variant="caption" className="px-4 pb-2">
        {t("reminders.pickerDescription", { event: event.title })}
      </Text>
      {REMINDER_OPTIONS.map((minutes) => {
        const label =
          minutes === null
            ? t("reminders.none")
            : minutes === 0
              ? t("reminders.atTime")
              : minutes === 60
                ? t("reminders.hourBefore")
                : t("reminders.minutesBefore", { minutes });
        return (
          <Pressable
            key={String(minutes)}
            testID={`convention-reminder-${minutes ?? "none"}`}
            onPress={() => {
              onSelect(event, minutes);
              onClose();
            }}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{
              checked: checkedMinutes === minutes,
            }}
            className="px-4 py-3.5 active:opacity-70 flex-row items-center justify-between"
          >
            <Text variant="body">{label}</Text>
            {checkedMinutes === minutes && (
              <Text className="text-primary">✓</Text>
            )}
          </Pressable>
        );
      })}
      <Pressable
        testID="convention-reminder-cancel"
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        className="px-4 py-3.5 active:opacity-70 mt-2 border-t border-border"
      >
        <Text variant="body" className="text-muted-foreground text-center">
          {t("common.cancel")}
        </Text>
      </Pressable>
    </View>
  );
}
