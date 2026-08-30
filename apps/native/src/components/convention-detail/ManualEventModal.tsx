import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, Switch, View } from "react-native";
import { NativeDateTimeField } from "@/components/convention-detail/NativeDateTimeField";
import {
  Card,
  Input,
  PRESS_DIM,
  SafeView,
  TAP_TARGET,
  Text,
} from "@/components/ui";
import { confirmDiscardChanges } from "@/hooks/useUnsavedChangesGuard";
import { currentLocale } from "@/lib/i18n";
import {
  createManualEventTimes,
  type ManualEventTimes,
  manualEventPickerDate,
  manualEventTimeParts,
  resolveManualEventInstant,
  updateManualEventDate,
  updateManualEventEnd,
  updateManualEventStart,
  validatedManualEventEnd,
} from "@/lib/manual-event-time";
import { cn } from "@/lib/utils";

export interface ManualEventDraft {
  title: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
}

interface ManualEventTextValues {
  title: string;
  room: string;
}

const EMPTY_MANUAL_EVENT_TEXT: ManualEventTextValues = {
  title: "",
  room: "",
};

interface ManualEventModalProps {
  visible: boolean;
  defaultDate: string;
  minimumDate: string;
  maximumDate: string;
  timeZone: string;
  onClose: () => void;
  onSave: (event: ManualEventDraft) => Promise<void>;
}

export function ManualEventModal(props: ManualEventModalProps) {
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
  const { t } = useTranslation();
  const locale = currentLocale();
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

  const isDirty =
    !saving &&
    (values.title.trim().length > 0 || values.room.trim().length > 0);

  function requestClose() {
    if (!isDirty) {
      onClose();
      return;
    }
    confirmDiscardChanges(t, onClose);
  }

  async function handleSave() {
    const title = values.title.trim();
    if (!title) {
      setError(t("convention.manualEvent.errors.title"));
      return;
    }

    const start = resolveManualEventInstant(
      manualEventTimeParts(times.startTime),
      timeZone,
    );
    if (!start) {
      setError(t("convention.manualEvent.errors.startTimeZone"));
      return;
    }

    let end: Date | null = null;
    if (includeEndTime) {
      // The end carries its own calendar day. Late-night programming routinely
      // runs past midnight, and rebuilding the end from the start's day threw
      // that roll-over away, so an overnight event failed validation instead
      // of saving.
      const endInstant = resolveManualEventInstant(
        manualEventTimeParts(times.endTime),
        timeZone,
      );
      if (!endInstant) {
        setError(t("convention.manualEvent.errors.endTimeZone"));
        return;
      }
      try {
        end = validatedManualEventEnd(start, endInstant, true);
      } catch {
        setError(t("convention.manualEvent.errors.order"));
        return;
      }
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
      // Android needs both to draw under the system bars like the rest of the app.
      statusBarTranslucent
      navigationBarTranslucent
      // Always handled: React Native requires this on Android, and passing
      // undefined while saving leaves the back gesture with no handler at all.
      onRequestClose={() => {
        if (!saving) requestClose();
      }}
    >
      <SafeView>
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable
            onPress={requestClose}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t("convention.manualEvent.cancelLabel")}
            // Matches Save opposite it. Without this VoiceOver offered Cancel
            // as available all through a save that had already disabled it.
            accessibilityState={{ disabled: saving }}
            className={cn(
              TAP_TARGET,
              "min-w-12 justify-center pr-3 disabled:opacity-50",
              PRESS_DIM,
            )}
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
            className={cn(
              TAP_TARGET,
              "min-w-12 justify-center pl-3 disabled:opacity-50",
              PRESS_DIM,
            )}
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
          <Input
            label={t("convention.manualEvent.titleLabel")}
            value={values.title}
            onChangeText={(value) => updateValue("title", value)}
            placeholder={t("convention.manualEvent.titlePlaceholder")}
            autoFocus
            accessibilityLabel={t("convention.manualEvent.titleAccessibility")}
          />

          <Card className="overflow-hidden rounded-xl p-0">
            <NativeDateTimeField
              label={t("convention.manualEvent.dateLabel")}
              value={times.date}
              mode="date"
              locale={locale}
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
              locale={locale}
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
                locale={locale}
                minimumDate={times.startTime}
                testID="manual-event-end-picker"
                onChange={(value) => {
                  setTimes((current) => updateManualEventEnd(current, value));
                  setError(null);
                }}
              />
            ) : null}
          </Card>

          <Input
            label={t("convention.manualEvent.roomLabel")}
            value={values.room}
            onChangeText={(value) => updateValue("room", value)}
            placeholder={t("convention.manualEvent.roomPlaceholder")}
            accessibilityLabel={t("convention.manualEvent.roomAccessibility")}
          />

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
