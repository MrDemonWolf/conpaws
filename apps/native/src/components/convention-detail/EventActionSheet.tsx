import { Bell, Calendar, MapPin } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, useColorScheme, View } from "react-native";
import { getEventIndicatorLabels } from "@/components/convention-detail/ConventionEventRow";
import { Badge, Banner, Button, PRESS_DIM, Text } from "@/components/ui";
import type { ConventionEvent } from "@/db/schema";
import { ageBadgeFor } from "@/lib/age-badge";
import { categoryAccentColor } from "@/lib/category-color";
import {
  eventDurationMinutes,
  formatEventEndDateTime,
  scheduleFormatter,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import { getCachedDefaultReminderMinutes } from "@/lib/reminder-default-storage";
import { themeTokens } from "@/lib/theme-tokens";

/**
 * Content of the event sheet, rendered inside a pushed `formSheet` route
 * (`/convention/[id]/event/[eventId]`) so the system owns presentation,
 * drag-to-dismiss, the grabber and VoiceOver's modal containment.
 *
 * The sheet now scrolls (the full description is shown, not four lines), so
 * the route uses fractional detents rather than `fitToContents`.
 */
export interface EventSheetConflict {
  title: string;
  minutes: number;
}

interface EventSheetContentProps {
  event: ConventionEvent;
  timeZone: string;
  hour12?: boolean;
  /** The convention's venue line, printed under the room. */
  venue?: string | null;
  /** Saved events this one overlaps; drives the compare action. */
  conflicts: readonly EventSheetConflict[];
  /** Dismiss the sheet; every action row calls this after acting. */
  onClose: () => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  onSelectReminder: (event: ConventionEvent, minutes: number | null) => void;
  /** Opens the compare sheet for this event. */
  onCompare: (event: ConventionEvent) => void;
}

export function EventSheetContent({
  event,
  timeZone,
  hour12,
  venue,
  conflicts,
  onClose,
  onToggleSchedule,
  onSelectReminder,
  onCompare,
}: EventSheetContentProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"actions" | "reminder">("actions");
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const tokens = themeTokens[scheme];

  const room = event.room ?? event.location;
  const locale = currentLocale();
  const { provenanceLabel, reminderLabel } = getEventIndicatorLabels(event, t);
  const ageBadge = ageBadgeFor(event.ageRating);
  const accent = categoryAccentColor(event.category, scheme);
  const duration = eventDurationMinutes(event.startTime, event.endTime);
  const feedStatusLabel = event.feedStatus
    ? t(
        event.feedStatus === "cancelled"
          ? "convention.feedStatus.cancelled"
          : "convention.feedStatus.removed",
      )
    : null;

  if (mode === "reminder") {
    return (
      <ReminderPickerContent
        event={event}
        onClose={onClose}
        onBack={() => setMode("actions")}
        onSelect={onSelectReminder}
      />
    );
  }

  const primaryLabel = event.isInSchedule
    ? t("convention.removeFromSchedule")
    : conflicts.length > 0
      ? t("convention.panel.compareBeforeAdding")
      : t("convention.addToSchedule");

  const dateLine = scheduleFormatter(
    "dateAndTime",
    locale,
    timeZone,
    hour12,
  ).format(new Date(event.startTime));
  const timeLine = [
    event.endTime
      ? t("convention.timeRangeTo", {
          time: formatEventEndDateTime(
            event.startTime,
            event.endTime,
            timeZone,
            locale,
            hour12,
          ),
        })
      : null,
    duration !== null
      ? t(
          duration === 1
            ? "convention.panel.durationMinutesOne"
            : "convention.panel.durationMinutesMany",
          { count: duration },
        )
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const overlapBody = conflicts
    .map((conflict) =>
      t("convention.panel.overlapWith", {
        minutes: conflict.minutes,
        title: conflict.title,
      }),
    )
    .join("; ");

  // The ScrollView is the sheet's root on purpose: react-native-screens sizes
  // a form sheet's first-child ScrollView to the sheet, and nothing else. A
  // wrapper view with a sibling footer left the body unlaid-out. The actions
  // therefore sit inside the scroll content, above the long description, so
  // they are in the first viewport without a sticky footer.
  return (
    <ScrollView
      testID="convention-event-actions"
      className="flex-1 bg-card"
      contentContainerStyle={{ paddingTop: 20, paddingBottom: 32 }}
    >
      <View className="gap-3 px-4">
        <View className="flex-row flex-wrap items-center gap-2">
          {event.category ? (
            <Text
              variant="caption"
              className="font-semibold uppercase tracking-wide"
              style={accent ? { color: accent } : undefined}
            >
              {event.category}
            </Text>
          ) : null}
          {ageBadge ? (
            <Badge
              variant={ageBadge.variant}
              emphasis="strong"
              label={t(ageBadge.key)}
            />
          ) : null}
          {event.contentWarning ? (
            <Badge
              variant="age-mature"
              emphasis="strong"
              label={t("convention.contentWarning")}
            />
          ) : null}
          {feedStatusLabel ? (
            <Badge variant="ended" emphasis="strong" label={feedStatusLabel} />
          ) : null}
        </View>
        <Text variant="h2" accessibilityRole="header" selectable>
          {event.title}
        </Text>

        <View className="gap-3 pt-1">
          <View className="flex-row gap-3">
            <Calendar size={20} color={tokens.mutedForeground} />
            <View className="flex-1">
              <Text variant="label" selectable>
                {dateLine}
              </Text>
              {timeLine ? (
                <Text variant="caption" selectable>
                  {timeLine}
                </Text>
              ) : null}
            </View>
          </View>
          {room ? (
            <View className="flex-row gap-3">
              <MapPin size={20} color={tokens.mutedForeground} />
              <View className="flex-1">
                <Text variant="label" selectable>
                  {room}
                </Text>
                {venue ? (
                  <Text variant="caption" selectable>
                    {venue}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}
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
            className={`flex-row items-center gap-3 ${PRESS_DIM}`}
          >
            <Bell size={20} color={tokens.mutedForeground} />
            <View className="flex-1">
              <Text variant="label">
                {reminderLabel ?? t("convention.panel.noReminder")}
              </Text>
              <Text variant="caption" className="text-primary">
                {event.reminderMinutes !== null
                  ? t("reminders.changeLeave")
                  : t("reminders.setLeave")}
              </Text>
            </View>
          </Pressable>
        </View>

        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={provenanceLabel}
          className="flex-row"
        >
          <Badge variant="neutral" label={provenanceLabel} />
        </View>
      </View>

      {conflicts.length > 0 ? (
        <Banner
          className="mt-4"
          title={
            event.isInSchedule
              ? t("convention.plan.overlap.title")
              : t("convention.panel.overlapsPlan")
          }
          body={overlapBody}
          actionLabel={
            event.isInSchedule ? t("convention.plan.overlap.cta") : undefined
          }
          onAction={event.isInSchedule ? () => onCompare(event) : undefined}
        />
      ) : null}

      <View className="gap-2 px-4 pt-4">
        <Button
          variant={event.isInSchedule ? "outline" : "default"}
          onPress={() => {
            if (!event.isInSchedule && conflicts.length > 0) {
              onCompare(event);
              return;
            }
            onToggleSchedule(event);
            onClose();
          }}
          accessibilityHint={t("convention.scheduleActionHint")}
          testID="convention-event-primary"
        >
          {primaryLabel}
        </Button>
        <Text variant="caption" className="text-center">
          {t("convention.browse.noSeat")}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("convention.closeEventDetails")}
          className={`min-h-12 items-center justify-center ${PRESS_DIM}`}
        >
          <Text variant="body" className="text-muted-foreground">
            {t("common.cancel")}
          </Text>
        </Pressable>
      </View>

      {event.description?.trim() ? (
        <View className="gap-1 px-4 pt-4">
          <Text variant="h3">{t("convention.panel.about")}</Text>
          <Text variant="body" selectable>
            {event.description.trim()}
          </Text>
        </View>
      ) : null}
    </ScrollView>
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
 * `0` is "At event time" — the string existed in all locales but was never
 * offered because 0 was missing here; the scheduler already handles a zero
 * lead time (it only rejects triggers that are in the past).
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
    <ScrollView
      testID="convention-reminder-picker"
      className="flex-1 bg-card"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
    >
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
            className="flex-row items-center justify-between px-4 py-3.5 active:opacity-70"
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
        className="mt-2 border-border border-t px-4 py-3.5 active:opacity-70"
      >
        <Text variant="body" className="text-center text-muted-foreground">
          {t("common.cancel")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
