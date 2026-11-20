import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, ScrollView, View } from "react-native";
import { NativeDateTimeField } from "@/components/convention-detail/NativeDateTimeField";
import { FormModalHeader } from "@/components/FormModalHeader";
import { FORM_SAFE_EDGES } from "@/components/FormModalHeader.shared";
import { ReminderChoices } from "@/components/ReminderChoices";
import {
  Banner,
  Button,
  Card,
  Chip,
  ReadableColumn,
  SafeView,
  Text,
} from "@/components/ui";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { compareCandidates } from "@/lib/compare-candidates";
import { formatInConventionTime, isValidTimeZone } from "@/lib/convention-time";
import { useHour12 } from "@/lib/device-clock";
import {
  hasVisit,
  isValidVisit,
  plannedEvent,
  VISIT_DURATIONS,
  validateDropInVisit,
  visitReminderHasPassed,
} from "@/lib/drop-in-visit";
import {
  formatEventDuration,
  formatEventEndTime,
  formatEventTime,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  manualEventDayKey,
  manualEventPickerDate,
} from "@/lib/manual-event-time";
import { confirmNotificationPriming } from "@/lib/notification-priming";
import { reminderDefaultLabel } from "@/lib/reminder-default-label";
import {
  getCachedDefaultReminderMinutes,
  REMINDER_DEFAULT_OPTIONS,
} from "@/lib/reminder-default-storage";
import { removeDropInVisit, saveDropInVisit } from "@/services/drop-in-visit";
import { hapticSuccess } from "@/services/haptics";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

export default function VisitRoute() {
  const { id, eventId } = useLocalSearchParams<{
    id: string;
    eventId: string;
  }>();
  const convention = useQuery({
    queryKey: ["convention", id],
    queryFn: () => conventionsRepo.getById(id ?? ""),
    enabled: !!id,
  });
  const events =
    useQuery({
      queryKey: ["events", id],
      queryFn: () => eventsRepo.getByConventionId(id ?? ""),
      enabled: !!id,
    }).data ?? [];
  const event = events.find((row) => row.id === eventId);
  const { t } = useTranslation();
  if (!event || !convention.data)
    return (
      <SafeView edges={FORM_SAFE_EDGES}>
        <Button onPress={() => router.back()}>{t("common.cancel")}</Button>
      </SafeView>
    );
  if (!isValidTimeZone(convention.data.timeZone))
    return (
      <SafeView edges={FORM_SAFE_EDGES}>
        <Text>{t("convention.manualEvent.errors.startTimeZone")}</Text>
        <Button onPress={() => router.back()}>{t("common.cancel")}</Button>
      </SafeView>
    );
  return (
    <VisitForm
      key={event.id}
      event={event}
      events={events}
      timeZone={convention.data.timeZone}
    />
  );
}

function VisitForm({
  event,
  events,
  timeZone,
}: {
  event: ConventionEvent;
  events: readonly ConventionEvent[];
  timeZone: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const locale = currentLocale();
  const hour12 = useHour12();
  const openingFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12,
  });
  const initialStart = isValidVisit(event)
    ? event.visitStartTime
    : event.startTime;
  const initialDate = formatInConventionTime(
    initialStart,
    timeZone,
    "yyyy-MM-dd",
  );
  const initialTime = formatInConventionTime(initialStart, timeZone, "HH:mm");
  const [date, setDate] = useState(() => manualEventPickerDate(initialDate));
  const [time, setTime] = useState(() =>
    manualEventPickerDate(
      initialDate,
      Number(initialTime.slice(0, 2)),
      Number(initialTime.slice(3)),
    ),
  );
  const initialDuration = isValidVisit(event)
    ? (Date.parse(event.visitEndTime) - Date.parse(event.visitStartTime)) /
      60_000
    : 30;
  const [durationMinutes, setDuration] = useState(initialDuration);
  const initialReminder = hasVisit(event)
    ? event.reminderMinutes
    : getCachedDefaultReminderMinutes();
  const [reminder, setReminder] = useState<number | null>(initialReminder);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [error, setError] = useState(false);
  const draft = {
    date: manualEventDayKey(date),
    time: `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`,
    durationMinutes,
  };
  const validation = validateDropInVisit(event, draft, timeZone);
  const proposed = validation.ok
    ? {
        ...event,
        startTime: validation.startTime,
        endTime: validation.endTime,
        isInSchedule: true,
        visitStartTime: null,
        visitEndTime: null,
      }
    : null;
  const conflicts = proposed
    ? (compareCandidates(
        [
          ...events.filter((row) => row.id !== event.id).map(plannedEvent),
          proposed,
        ],
        event.id,
      )?.conflicts ?? [])
    : [];
  const dirty =
    draft.date !== initialDate ||
    draft.time !== initialTime ||
    durationMinutes !== initialDuration ||
    reminder !== initialReminder;
  const { confirmDiscard } = useUnsavedChangesGuard({
    isDirty: dirty && !saving,
    onDiscard: () => router.back(),
  });
  async function finish(remove = false) {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      if (remove) await removeDropInVisit(event);
      else
        await saveDropInVisit(event, draft, timeZone, reminder, {
          confirmPermissionPrompt: () => confirmNotificationPriming(t),
        });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["events", event.conventionId],
        }),
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
        publishWidgetSnapshot().catch(() => false),
      ]);
      if (!mounted.current) return;
      hapticSuccess();
      router.back();
    } catch {
      if (!mounted.current) return;
      setError(true);
      setSaving(false);
    }
  }
  // A visit to a drop-in that is already open usually starts now, so the
  // default lead time can point at a moment that has passed. The system
  // cannot schedule that, and saving would fail with a generic error; say so
  // here instead and let the reader pick a lead time that can still fire.
  const reminderPassed =
    validation.ok &&
    visitReminderHasPassed(validation.startTime, reminder, Date.now());
  const canSave =
    validation.ok && event.feedStatus === null && !saving && !reminderPassed;
  return (
    <SafeView edges={FORM_SAFE_EDGES}>
      {process.env.EXPO_OS === "ios" ? (
        <>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button onPress={confirmDiscard} disabled={saving}>
              {t("common.cancel")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              onPress={() => finish()}
              disabled={!canSave}
              variant="done"
            >
              {t("common.save")}
            </Stack.Toolbar.Button>
          </Stack.Toolbar>
        </>
      ) : (
        <FormModalHeader
          title={t("convention.visit.title")}
          cancelLabel={t("common.cancel")}
          onCancel={confirmDiscard}
          confirmLabel={t("common.save")}
          onConfirm={() => finish()}
          confirmDisabled={!canSave}
        />
      )}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16 }}
      >
        {/* A full-screen modal on both platforms, so the window is the
            container. The gap moved here from the content container with the
            children, which keeps a phone's layout the same. */}
        <ReadableColumn gutter={false} style={{ gap: 16 }}>
          <Text variant="h3">{event.title}</Text>
          <Text variant="caption">
            {openingFormatter.format(new Date(event.startTime))}–
            {openingFormatter.format(
              new Date(event.endTime ?? event.startTime),
            )}{" "}
            · {timeZone}
          </Text>
          {hasVisit(event) && !isValidVisit(event) ? (
            <Text accessibilityRole="alert">
              {t("convention.visit.invalid")}
            </Text>
          ) : null}
          <Card className="p-0">
            <NativeDateTimeField
              label={t("convention.manualEvent.dateLabel")}
              value={date}
              mode="date"
              locale={locale}
              testID="visit-date"
              onChange={setDate}
            />
            <NativeDateTimeField
              label={t("convention.manualEvent.startLabel")}
              value={time}
              mode="time"
              locale={locale}
              testID="visit-time"
              onChange={setTime}
            />
          </Card>
          <Text variant="label">{t("convention.visit.duration")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {VISIT_DURATIONS.map((minutes) => (
              <Chip
                key={minutes}
                label={formatEventDuration(minutes, t)}
                selected={durationMinutes === minutes}
                onPress={() => setDuration(minutes)}
              />
            ))}
          </View>
          <ReminderChoices
            label={t("reminders.pickerTitle")}
            value={reminder}
            options={REMINDER_DEFAULT_OPTIONS}
            onChange={setReminder}
            testID="visit-reminder"
          />
          {validation.ok ? (
            <Card>
              <Text variant="body">
                {openingFormatter.format(new Date(validation.startTime))} ·{" "}
                {t("convention.timeRangeTo", {
                  time: formatEventEndTime(
                    validation.startTime,
                    validation.endTime,
                    timeZone,
                    locale,
                    hour12,
                  ),
                })}{" "}
                · {formatEventDuration(durationMinutes, t)}
              </Text>
              <Text variant="caption">
                {t("convention.now.reminder", {
                  label:
                    reminder === null
                      ? t("reminders.none")
                      : `${reminderDefaultLabel(reminder, t)} · ${formatEventTime(new Date(Date.parse(validation.startTime) - reminder * 60_000).toISOString(), timeZone, locale, hour12)}`,
                })}
              </Text>
            </Card>
          ) : null}
          {conflicts.length > 0 ? (
            <Banner
              tone="info"
              title={t("convention.plan.overlap.title")}
              body={`${t("convention.plan.overlap.body")} ${conflicts.map((row) => row.title).join(", ")}`}
              testID="visit-overlap-warning"
            />
          ) : null}
          {!validation.ok ? (
            <Text accessibilityRole="alert">
              {t(
                validation.reason === "time" ||
                  validation.reason === "time-zone"
                  ? "convention.manualEvent.errors.startTimeZone"
                  : "convention.visit.windowError",
              )}
            </Text>
          ) : null}
          {reminderPassed ? (
            <Text accessibilityRole="alert" testID="visit-reminder-passed">
              {t("reminders.tooLateMessage")}
            </Text>
          ) : error ? (
            <Text accessibilityRole="alert">{t("reminders.errorMessage")}</Text>
          ) : null}
          {hasVisit(event) ? (
            <Button
              variant="destructive"
              disabled={saving}
              onPress={() =>
                Alert.alert(t("convention.visit.remove"), event.title, [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("convention.visit.remove"),
                    style: "destructive",
                    onPress: () => finish(true),
                  },
                ])
              }
            >
              {t("convention.visit.remove")}
            </Button>
          ) : null}
        </ReadableColumn>
      </ScrollView>
    </SafeView>
  );
}
