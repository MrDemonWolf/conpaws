import AddIcon from "@expo/material-symbols/add.xml";
import EventIcon from "@expo/material-symbols/event.xml";
import FilterListIcon from "@expo/material-symbols/filter_list.xml";
import UploadIcon from "@expo/material-symbols/upload.xml";
import { Host, Icon } from "@expo/ui";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { getCalendars } from "expo-localization";
import {
  router,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import * as WebBrowser from "expo-web-browser";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  Switch,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { EventItem } from "@/components/EventItem";
import { SectionHeader } from "@/components/SectionHeader";
import {
  Badge,
  Button,
  EmptyState,
  LoadingSpinner,
  SafeView,
  Text,
} from "@/components/ui";
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
import { resolveConventionPreviewState } from "@/lib/developer-tools";
import {
  getEventIndicators,
  shouldShowProvenance,
} from "@/lib/event-indicators";
import {
  createManualEventTimes,
  type ManualEventTimes,
  manualEventDayKey,
  manualEventPickerDate,
  updateManualEventDate,
  updateManualEventEnd,
  updateManualEventStart,
  validatedManualEventEnd,
} from "@/lib/manual-event-time";
import {
  resetPresentationLock,
  tryAcquirePresentationLock,
} from "@/lib/presentation-lock";
import { getNowAndNextEvents } from "@/lib/schedule-view";
import { cn } from "@/lib/utils";
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
const IMPORT_SCHEDULE_ICON = Icon.select({
  ios: "square.and.arrow.down",
  android: UploadIcon,
});
const ADD_EVENT_ICON = Icon.select({
  ios: "calendar.badge.plus",
  android: AddIcon,
});
const EMPTY_LIST_CONTENT_STYLE = { flexGrow: 1 } as const;
const EMPTY_CONVENTION_CONTENT_STYLE = {
  flexGrow: 1,
  justifyContent: "center",
  paddingBottom: 48,
  paddingTop: 24,
} as const;

interface BlankConventionStateProps {
  title: string;
  subtitle: string;
  dateRange: string;
  timeZoneLabel: string;
  importLabel: string;
  addLabel: string;
  onImport: () => void;
  onAdd: () => void;
}

function BlankConventionState({
  title,
  subtitle,
  dateRange,
  timeZoneLabel,
  importLabel,
  addLabel,
  onImport,
  onAdd,
}: BlankConventionStateProps) {
  const colorScheme = useColorScheme();
  const { colors } = useTheme();

  return (
    <View className="flex-1 justify-center px-6 py-6">
      <View className="items-center gap-3">
        <Host
          colorScheme={colorScheme === "dark" ? "dark" : "light"}
          matchContents
          pointerEvents="none"
        >
          <Icon name={EMPTY_SCHEDULE_ICON} size={32} color={colors.primary} />
        </Host>
        <View className="items-center gap-1.5">
          <Text variant="h3" className="text-center">
            {title}
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            {subtitle}
          </Text>
        </View>
        <View className="items-center gap-1 pt-1">
          <Text variant="label" className="text-center" selectable>
            {dateRange}
          </Text>
          <Text variant="caption" className="text-center" selectable>
            {timeZoneLabel}
          </Text>
        </View>
      </View>
      <View className="flex-row flex-wrap items-center justify-center gap-2 pt-4">
        <Button accessibilityLabel={importLabel} size="sm" onPress={onImport}>
          <View className="flex-row items-center gap-1.5">
            <Host
              colorScheme={colorScheme === "dark" ? "dark" : "light"}
              matchContents
              pointerEvents="none"
              style={{ width: 18, height: 18 }}
            >
              <Icon
                name={IMPORT_SCHEDULE_ICON}
                size={18}
                color={colors.background}
              />
            </Host>
            <Text variant="label" className="text-primary-foreground">
              {importLabel}
            </Text>
          </View>
        </Button>
        <Button
          accessibilityLabel={addLabel}
          size="sm"
          variant="outline"
          onPress={onAdd}
        >
          <View className="flex-row items-center gap-1.5">
            <Host
              colorScheme={colorScheme === "dark" ? "dark" : "light"}
              matchContents
              pointerEvents="none"
              style={{ width: 18, height: 18 }}
            >
              <Icon name={ADD_EVENT_ICON} size={18} color={colors.primary} />
            </Host>
            <Text variant="label">{addLabel}</Text>
          </View>
        </Button>
      </View>
    </View>
  );
}

interface ManualEventTextValues {
  title: string;
  room: string;
}

interface ManualEventDraft {
  title: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
}

const EMPTY_MANUAL_EVENT_TEXT: ManualEventTextValues = {
  title: "",
  room: "",
};

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

function getEventIndicatorLabels(
  event: Pick<ConventionEvent, "reminderMinutes" | "sourceUid">,
  t: TFunction,
): { provenanceLabel: string; reminderLabel?: string } {
  const { provenance, reminder } = getEventIndicators(event);

  return {
    provenanceLabel: t(`convention.eventSource.${provenance}`),
    reminderLabel: reminder
      ? t(
          reminder.kind === "hour"
            ? "reminders.hourBefore"
            : "reminders.minutesBefore",
          { minutes: reminder.minutes },
        )
      : undefined,
  };
}

interface ActionSheetProps {
  event: ConventionEvent | null;
  visible: boolean;
  timeZone: string;
  onClose: () => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  onSelectReminder: (event: ConventionEvent, minutes: number | null) => void;
}

function EventActionSheet({
  event,
  visible,
  timeZone,
  onClose,
  onToggleSchedule,
  onSelectReminder,
}: ActionSheetProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"actions" | "reminder">("actions");
  if (!event) return null;

  function closeSheet() {
    setMode("actions");
    onClose();
  }

  const room = event.room ?? event.location;
  const sourceUrl = event.sourceUrl;
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { provenanceLabel, reminderLabel } = getEventIndicatorLabels(event, t);
  const scheduleAction = event.isInSchedule
    ? t("convention.removeFromSchedule")
    : t("convention.addToSchedule");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeSheet}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <Pressable
          accessible={false}
          className="absolute inset-0"
          onPress={closeSheet}
        />
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          onAccessibilityEscape={closeSheet}
          className="z-10 bg-card rounded-t-2xl"
          style={{ maxHeight: "85%" }}
          testID={
            mode === "reminder"
              ? "convention-reminder-picker"
              : "convention-event-actions"
          }
        >
          {mode === "reminder" ? (
            <ReminderPickerContent
              event={event}
              onClose={closeSheet}
              onSelect={onSelectReminder}
            />
          ) : (
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
                onPress={closeSheet}
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
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

interface ReminderPickerContentProps {
  event: ConventionEvent;
  onClose: () => void;
  onSelect: (event: ConventionEvent, minutes: number | null) => void;
}

const REMINDER_OPTIONS = [null, 5, 10, 15, 30, 60] as const;

function ReminderPickerContent({
  event,
  onClose,
  onSelect,
}: ReminderPickerContentProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <View className="w-10 h-1 bg-border rounded-full self-center mt-3 mb-4" />
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
      <Pressable
        testID="convention-reminder-cancel"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        className="px-4 py-3.5 active:opacity-70 mt-2 border-t border-border"
      >
        <Text variant="body" className="text-muted-foreground text-center">
          {t("common.cancel")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

interface NativeDateTimeFieldProps {
  label: string;
  value: Date;
  mode: "date" | "time";
  locale: string;
  minimumDate?: Date;
  maximumDate?: Date;
  showDivider?: boolean;
  testID: string;
  onChange: (value: Date) => void;
}

function NativeDateTimeField({
  label,
  value,
  mode,
  locale,
  minimumDate,
  maximumDate,
  showDivider = false,
  testID,
  onChange,
}: NativeDateTimeFieldProps) {
  const colorScheme = useColorScheme();
  const { fontScale } = useWindowDimensions();
  const [dialogVisible, setDialogVisible] = useState(false);
  const formattedValue =
    mode === "date"
      ? value.toLocaleDateString(locale, { dateStyle: "medium" })
      : value.toLocaleTimeString(locale, { timeStyle: "short" });
  const fieldClassName = cn(
    "min-h-14 flex-row items-center justify-between gap-4 px-4 py-2",
    showDivider && "border-b border-border",
  );
  // The compact UIDatePicker stretches to fill the row and then overflows past
  // its label, clipping the value against the card edge. It has no intrinsic
  // width and ignores flexShrink, so the frame has to be set explicitly.
  // ponytail: base widths fit the widest en-US value ("Sep 30, 2026" /
  // "10:00 PM") and scale with Dynamic Type. If a locale renders wider than
  // en-US, measure onLayout instead of widening these further.
  const pickerWidth = Math.round(
    (mode === "date" ? 148 : 112) * Math.min(Math.max(fontScale, 1), 1.6),
  );

  if (process.env.EXPO_OS === "ios") {
    return (
      <View className={fieldClassName}>
        <Text variant="body" className="shrink" numberOfLines={1}>
          {label}
        </Text>
        <DateTimePicker
          style={{ width: pickerWidth }}
          value={value}
          mode={mode}
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          locale={locale}
          themeVariant={colorScheme === "dark" ? "dark" : "light"}
          testID={testID}
          onValueChange={(_, nextValue) => onChange(nextValue)}
        />
      </View>
    );
  }

  return (
    <>
      <Pressable
        className={cn(fieldClassName, "active:opacity-70")}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        onPress={() => setDialogVisible(true)}
      >
        <Text variant="body">{label}</Text>
        <Text variant="body" className="text-primary" selectable>
          {formattedValue}
        </Text>
      </Pressable>
      {dialogVisible ? (
        <DateTimePicker
          value={value}
          mode={mode}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          presentation="dialog"
          onValueChange={(_, nextValue) => {
            onChange(nextValue);
            setDialogVisible(false);
          }}
          onDismiss={() => setDialogVisible(false)}
        />
      ) : null}
    </>
  );
}

interface ManualEventModalProps {
  visible: boolean;
  defaultDate: string;
  minimumDate: string;
  maximumDate: string;
  timeZone: string;
  onClose: () => void;
  onSave: (event: ManualEventDraft) => Promise<void>;
}

function ManualEventModal(props: ManualEventModalProps) {
  return props.visible ? <ManualEventModalContent {...props} /> : null;
}

function ManualEventModalContent({
  defaultDate,
  minimumDate,
  maximumDate,
  timeZone,
  onClose,
  onSave,
}: ManualEventModalProps) {
  const { t, i18n } = useTranslation();
  const [values, setValues] = useState<ManualEventTextValues>(
    EMPTY_MANUAL_EVENT_TEXT,
  );
  const [times, setTimes] = useState<ManualEventTimes>(() =>
    createManualEventTimes(defaultDate, minimumDate, maximumDate),
  );
  const [includeEndTime, setIncludeEndTime] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateValue(key: keyof ManualEventTextValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    const title = values.title.trim();
    if (!title) {
      setError(t("convention.manualEvent.errors.title"));
      return;
    }

    const dayKey = manualEventDayKey(times.date);
    const date = {
      year: times.date.getFullYear(),
      month: times.date.getMonth() + 1,
      day: times.date.getDate(),
    };
    const startParts = {
      hour: times.startTime.getHours(),
      minute: times.startTime.getMinutes(),
    };
    const endParts = {
      hour: times.endTime.getHours(),
      minute: times.endTime.getMinutes(),
    };
    const start = fromConventionTime({ ...date, ...startParts }, timeZone);
    const normalizedStart = `${dayKey} ${String(startParts.hour).padStart(2, "0")}:${String(startParts.minute).padStart(2, "0")}`;
    if (
      formatInConventionTime(start, timeZone, "yyyy-MM-dd HH:mm") !==
      normalizedStart
    ) {
      setError(t("convention.manualEvent.errors.startTimeZone"));
      return;
    }

    const endCandidate = fromConventionTime({ ...date, ...endParts }, timeZone);
    let end: Date | null;
    try {
      end = validatedManualEventEnd(start, endCandidate, includeEndTime);
    } catch {
      setError(t("convention.manualEvent.errors.order"));
      return;
    }
    const normalizedEnd = `${dayKey} ${String(endParts.hour).padStart(2, "0")}:${String(endParts.minute).padStart(2, "0")}`;
    if (
      end &&
      formatInConventionTime(end, timeZone, "yyyy-MM-dd HH:mm") !==
        normalizedEnd
    ) {
      setError(t("convention.manualEvent.errors.endTimeZone"));
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
    }
    setSaving(false);
  }

  return (
    <Modal
      visible
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

          <View className="overflow-hidden rounded-xl border border-border bg-card">
            <NativeDateTimeField
              label={t("convention.manualEvent.dateLabel")}
              value={times.date}
              mode="date"
              locale={i18n.resolvedLanguage ?? i18n.language}
              minimumDate={manualEventPickerDate(minimumDate)}
              maximumDate={manualEventPickerDate(maximumDate)}
              showDivider
              testID="manual-event-date-picker"
              onChange={(value) => {
                setTimes((current) =>
                  updateManualEventDate(
                    current,
                    value,
                    minimumDate,
                    maximumDate,
                  ),
                );
                setError(null);
              }}
            />
            <NativeDateTimeField
              label={t("convention.manualEvent.startLabel")}
              value={times.startTime}
              mode="time"
              locale={i18n.resolvedLanguage ?? i18n.language}
              showDivider
              testID="manual-event-start-picker"
              onChange={(value) => {
                setTimes((current) =>
                  updateManualEventStart(current, value, includeEndTime),
                );
                setError(null);
              }}
            />
            <View
              className={cn(
                "min-h-14 flex-row items-center justify-between gap-4 px-4 py-2",
                includeEndTime && "border-b border-border",
              )}
            >
              <Text variant="body">{t("convention.manualEvent.endLabel")}</Text>
              <Switch
                value={includeEndTime}
                onValueChange={(value) => {
                  if (value) {
                    setTimes((current) =>
                      updateManualEventStart(current, current.startTime, true),
                    );
                  }
                  setIncludeEndTime(value);
                  setError(null);
                }}
                accessibilityLabel={t(
                  "convention.manualEvent.endAccessibility",
                )}
              />
            </View>
            {includeEndTime ? (
              <NativeDateTimeField
                label={t("convention.manualEvent.endLabel")}
                value={times.endTime}
                mode="time"
                locale={i18n.resolvedLanguage ?? i18n.language}
                minimumDate={times.startTime}
                testID="manual-event-end-picker"
                onChange={(value) => {
                  setTimes((current) => updateManualEventEnd(current, value));
                  setError(null);
                }}
              />
            ) : null}
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
  const { id, previewState: requestedPreviewState } = useLocalSearchParams<{
    id: string;
    previewState?: string;
  }>();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const previewState = resolveConventionPreviewState(
    requestedPreviewState,
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );
  const presentationLock = useRef(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualEventVisible, setManualEventVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [actionSheetEvent, setActionSheetEvent] =
    useState<ConventionEvent | null>(null);

  useFocusEffect(
    useCallback(() => {
      resetPresentationLock(presentationLock);
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

  const isLoading =
    previewState === "loading" ||
    (previewState !== "error" && (conventionLoading || eventsLoading));

  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: convention?.name ?? t("convention.loadingTitle"),
          }}
        />
        <SafeView>
          <View className="flex-1 justify-center px-6">
            <View
              className="items-center gap-3 rounded-3xl border border-border bg-card px-6 py-8"
              style={{ borderCurve: "continuous" }}
              accessibilityLiveRegion="polite"
            >
              <LoadingSpinner size="large" className="h-12 flex-none" />
              <Text variant="h3" className="text-center">
                {t("convention.loadingTitle")}
              </Text>
              <Text
                variant="body"
                className="text-center text-muted-foreground"
              >
                {t("convention.loadingSubtitle")}
              </Text>
            </View>
          </View>
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
    start: dateFormatter.format(new Date(`${convention.startDate}T12:00:00`)),
    end: dateFormatter.format(new Date(`${convention.endDate}T12:00:00`)),
  });

  function renderEventRow(event: ConventionEvent) {
    const { provenanceLabel, reminderLabel } = getEventIndicatorLabels(
      event,
      t,
    );

    return (
      <EventItem
        key={event.id}
        testID={`convention-event-${event.id}`}
        title={event.title}
        startTime={formatTime(event.startTime, conventionTimeZone, locale)}
        endTime={formatTime(event.endTime, conventionTimeZone, locale)}
        room={event.room ?? event.location ?? undefined}
        category={event.category ?? undefined}
        description={event.description}
        ageRating={event.ageRating}
        isInSchedule={event.isInSchedule}
        reminderLabel={reminderLabel}
        provenanceLabel={showProvenance ? provenanceLabel : undefined}
        hasConflict={conflictingEventIds.has(event.id)}
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
                : EMPTY_LIST_CONTENT_STYLE
              : undefined
          }
          ListHeaderComponent={dayGroups.length > 0 ? scheduleNotices : null}
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
