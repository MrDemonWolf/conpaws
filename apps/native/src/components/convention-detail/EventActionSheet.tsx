import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { getEventIndicatorLabels } from "@/components/convention-detail/ConventionEventRow";
import { NativeDateTimeField } from "@/components/convention-detail/NativeDateTimeField";
import { Badge, Text } from "@/components/ui";
import type { ConventionEvent } from "@/db/schema";
import {
  conventionDayKey,
  formatInConventionTime,
} from "@/lib/convention-time";
import {
  formatEventEndDateTime,
  formatEventEndTime,
  formatEventTime,
  scheduleFormatter,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  manualEventPickerDate,
  manualEventTimeParts,
  resolveManualEventInstant,
} from "@/lib/manual-event-time";
import {
  type AttendanceTimeError,
  attendanceInterval,
  attendanceTimeError,
} from "@/lib/personal-schedule";
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
  onToggleInterest: (event: ConventionEvent) => void;
  onSaveAttendance: (
    event: ConventionEvent,
    personalStartTime: string | null,
    personalEndTime: string | null,
  ) => void;
  onSelectReminder: (event: ConventionEvent, minutes: number | null) => void;
  plannedEvents: readonly ConventionEvent[];
}

export function EventSheetContent({
  event,
  timeZone,
  hour12,
  onClose,
  onToggleSchedule,
  onToggleInterest,
  onSaveAttendance,
  onSelectReminder,
  plannedEvents,
}: EventSheetContentProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"actions" | "attendance" | "reminder">(
    "actions",
  );

  const room = event.room ?? event.location;
  const locale = currentLocale();
  const { provenanceLabel, reminderLabel } = getEventIndicatorLabels(event, t);
  const scheduleAction = event.isInSchedule
    ? t("convention.removeFromSchedule")
    : t("convention.addToSchedule");
  const interestAction = event.isInterested
    ? t("convention.removeInterest")
    : t("convention.addInterest");
  const personalInterval = attendanceInterval(event);
  const hasPersonalTimes =
    event.personalStartTime !== null || event.personalEndTime !== null;
  const personalTimeLabel = hasPersonalTimes
    ? t("convention.attendance.yourTimeRange", {
        start: formatEventTime(
          personalInterval.startTime,
          timeZone,
          locale,
          hour12,
        ),
        end: personalInterval.endTime
          ? formatEventEndTime(
              personalInterval.startTime,
              personalInterval.endTime,
              timeZone,
              locale,
              hour12,
            )
          : t("convention.attendance.unknownEnd"),
      })
    : null;

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

  if (mode === "attendance") {
    return (
      <AttendanceEditorContent
        event={event}
        plannedEvents={plannedEvents}
        timeZone={timeZone}
        locale={locale}
        hour12={hour12}
        onBack={() => setMode("actions")}
        onClose={onClose}
        onSave={onSaveAttendance}
      />
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
          event.isInSchedule ? t("convention.going") : null,
          event.isInterested ? t("convention.interested") : null,
          event.feedStatus
            ? t(`convention.feedStatus.${event.feedStatus}`)
            : null,
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
        {event.isInSchedule ? (
          <Badge variant="active" label={t("convention.going")} />
        ) : null}
        {event.isInterested ? (
          <Badge variant="info" label={t("convention.interested")} />
        ) : null}
        {event.feedStatus ? (
          <Badge
            variant="ended"
            label={t(`convention.feedStatus.${event.feedStatus}`)}
          />
        ) : null}
        <Badge variant="neutral" label={provenanceLabel} />
      </View>
      {personalInterval.needsReview ? (
        <Text variant="caption" className="px-4 pt-3 text-destructive">
          {t("convention.attendance.reviewNeeded")}
        </Text>
      ) : personalTimeLabel ? (
        <Text variant="caption" className="px-4 pt-3 text-primary" selectable>
          {personalTimeLabel}
        </Text>
      ) : null}
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
          onToggleInterest(event);
          onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel={interestAction}
        accessibilityHint={t("convention.interestActionHint")}
        className="px-4 py-3.5 active:opacity-70"
      >
        <Text variant="body">{interestAction}</Text>
      </Pressable>

      {event.feedStatus === null || event.isInSchedule ? (
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
      ) : null}

      {event.feedStatus === null ? (
        <Pressable
          onPress={() => setMode("attendance")}
          accessibilityRole="button"
          accessibilityLabel={
            hasPersonalTimes
              ? t("convention.attendance.changeTimes")
              : t("convention.attendance.setTimes")
          }
          accessibilityHint={t("convention.attendance.actionHint")}
          className="px-4 py-3.5 active:opacity-70"
        >
          <Text variant="body">
            {hasPersonalTimes
              ? t("convention.attendance.changeTimes")
              : t("convention.attendance.setTimes")}
          </Text>
        </Pressable>
      ) : null}

      {event.isInSchedule && event.feedStatus === null ? (
        <Pressable
          onPress={() => setMode("reminder")}
          accessibilityRole="button"
          accessibilityLabel={
            event.reminderMinutes !== null
              ? t("reminders.changeStart")
              : t("reminders.setStart")
          }
          accessibilityHint={t("reminders.pickerDescriptionStart", {
            event: event.title,
          })}
          className="px-4 py-3.5 active:opacity-70"
        >
          <Text variant="body">
            {event.reminderMinutes !== null
              ? t("reminders.changeStart")
              : t("reminders.setStart")}
          </Text>
        </Pressable>
      ) : null}

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

interface AttendanceEditorContentProps {
  event: ConventionEvent;
  plannedEvents: readonly ConventionEvent[];
  timeZone: string;
  locale: string;
  hour12?: boolean;
  onBack: () => void;
  onClose: () => void;
  onSave: (
    event: ConventionEvent,
    personalStartTime: string | null,
    personalEndTime: string | null,
  ) => void;
}

function attendancePickerDate(
  value: string | null | undefined,
  fallback: string,
  timeZone: string,
): Date {
  const instant =
    value && Number.isFinite(Date.parse(value)) ? value : fallback;
  return manualEventPickerDate(
    conventionDayKey(instant, timeZone),
    Number(formatInConventionTime(instant, timeZone, "H")),
    Number(formatInConventionTime(instant, timeZone, "m")),
  );
}

function intervalsOverlap(
  left: ConventionEvent,
  right: ConventionEvent,
): boolean {
  const leftInterval = attendanceInterval(left);
  const rightInterval = attendanceInterval(right);
  if (!leftInterval.endTime || !rightInterval.endTime) return false;
  const leftStart = Date.parse(leftInterval.startTime);
  const leftEnd = Date.parse(leftInterval.endTime);
  const rightStart = Date.parse(rightInterval.startTime);
  const rightEnd = Date.parse(rightInterval.endTime);
  return (
    Number.isFinite(leftStart) &&
    Number.isFinite(leftEnd) &&
    Number.isFinite(rightStart) &&
    Number.isFinite(rightEnd) &&
    leftStart < rightEnd &&
    rightStart < leftEnd
  );
}

function attendanceErrorKey(error: AttendanceTimeError) {
  switch (error) {
    case "before-event-start":
      return "convention.attendance.errors.beforeStart" as const;
    case "after-event-end":
      return "convention.attendance.errors.afterEnd" as const;
    case "start-not-before-end":
      return "convention.attendance.errors.order" as const;
    default:
      return "convention.attendance.errors.invalid" as const;
  }
}

function AttendanceEditorContent({
  event,
  plannedEvents,
  timeZone,
  locale,
  hour12,
  onBack,
  onClose,
  onSave,
}: AttendanceEditorContentProps) {
  const { t } = useTranslation();
  const fallbackEnd = new Date(
    Date.parse(event.startTime) + 60 * 60 * 1000,
  ).toISOString();
  const publishedEnd =
    event.endTime && Number.isFinite(Date.parse(event.endTime))
      ? event.endTime
      : fallbackEnd;
  const [startPicker, setStartPicker] = useState(() =>
    attendancePickerDate(event.personalStartTime, event.startTime, timeZone),
  );
  const [endPicker, setEndPicker] = useState(() =>
    attendancePickerDate(event.personalEndTime, publishedEnd, timeZone),
  );

  const personalStart = resolveManualEventInstant(
    manualEventTimeParts(startPicker),
    timeZone,
  )?.toISOString();
  const personalEnd = resolveManualEventInstant(
    manualEventTimeParts(endPicker),
    timeZone,
  )?.toISOString();
  const candidate = {
    ...event,
    personalStartTime: personalStart ?? "invalid",
    personalEndTime: personalEnd ?? "invalid",
  };
  const error = attendanceTimeError(candidate);
  const conflicts =
    error === null
      ? plannedEvents.filter(
          (other) =>
            other.id !== event.id &&
            other.isInSchedule &&
            other.feedStatus === null &&
            intervalsOverlap(candidate, other),
        )
      : [];

  return (
    <View testID="convention-attendance-editor" className="bg-card pt-4 pb-8">
      <Text variant="h3" className="px-4" accessibilityRole="header">
        {t("convention.attendance.title")}
      </Text>
      <Text variant="caption" className="px-4 pt-1 text-muted-foreground">
        {event.title}
      </Text>
      <Text variant="caption" className="px-4 pt-2">
        {t("convention.attendance.publishedRange", {
          start: formatEventTime(event.startTime, timeZone, locale, hour12),
          end: event.endTime
            ? formatEventEndTime(
                event.startTime,
                event.endTime,
                timeZone,
                locale,
                hour12,
              )
            : t("convention.attendance.unknownEnd"),
        })}
      </Text>
      <View className="mx-4 mt-4 overflow-hidden rounded-xl border border-border">
        <NativeDateTimeField
          label={t("convention.attendance.joinAt")}
          value={startPicker}
          mode="time"
          locale={locale}
          minimumDate={attendancePickerDate(
            event.startTime,
            event.startTime,
            timeZone,
          )}
          maximumDate={
            event.endTime
              ? attendancePickerDate(event.endTime, event.endTime, timeZone)
              : undefined
          }
          showDivider
          testID="attendance-start-picker"
          onChange={setStartPicker}
        />
        <NativeDateTimeField
          label={t("convention.attendance.leaveAt")}
          value={endPicker}
          mode="time"
          locale={locale}
          minimumDate={startPicker}
          maximumDate={
            event.endTime
              ? attendancePickerDate(event.endTime, event.endTime, timeZone)
              : undefined
          }
          testID="attendance-end-picker"
          onChange={setEndPicker}
        />
      </View>
      {event.endTime === null ? (
        <Text variant="caption" className="px-4 pt-3 text-muted-foreground">
          {t("convention.attendance.unknownEndHelp")}
        </Text>
      ) : null}
      {error ? (
        <Text
          variant="caption"
          className="px-4 pt-3 text-destructive"
          accessibilityRole="alert"
        >
          {t(attendanceErrorKey(error))}
        </Text>
      ) : conflicts.length > 0 ? (
        <Text
          variant="caption"
          className="px-4 pt-3 text-destructive"
          accessibilityRole="alert"
        >
          {t("convention.attendance.overlapWarning", {
            events: conflicts.map((item) => item.title).join(", "),
          })}
        </Text>
      ) : (
        <Text variant="caption" className="px-4 pt-3 text-muted-foreground">
          {t("convention.attendance.gapHelp")}
        </Text>
      )}

      <Pressable
        disabled={error !== null}
        onPress={() => {
          if (!personalStart || !personalEnd || error) return;
          onSave(event, personalStart, personalEnd);
          onClose();
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: error !== null }}
        className="mx-4 mt-4 min-h-11 items-center justify-center rounded-xl bg-primary px-4 active:opacity-70 disabled:opacity-40"
      >
        <Text variant="label" className="text-primary-foreground">
          {conflicts.length > 0
            ? t("convention.attendance.saveWithOverlap")
            : t("convention.attendance.save")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          onSave(event, null, null);
          onClose();
        }}
        accessibilityRole="button"
        className="px-4 py-3.5 active:opacity-70"
      >
        <Text variant="body" className="text-primary text-center">
          {t("convention.attendance.usePublished")}
        </Text>
      </Pressable>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        className="px-4 py-3.5 active:opacity-70 border-t border-border"
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
        {t("reminders.pickerDescriptionStart", { event: event.title })}
      </Text>
      {REMINDER_OPTIONS.map((minutes) => {
        const label =
          minutes === null
            ? t("reminders.noneStart")
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
