import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { getEventIndicatorLabels } from "@/components/convention-detail/ConventionEventRow";
import { Badge, Text } from "@/components/ui";
import type { ConventionEvent } from "@/db/schema";
import { formatEventTime, scheduleFormatter } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";

interface ActionSheetProps {
  event: ConventionEvent | null;
  visible: boolean;
  timeZone: string;
  hour12?: boolean;
  onClose: () => void;
  onToggleSchedule: (event: ConventionEvent) => void;
  onSelectReminder: (event: ConventionEvent, minutes: number | null) => void;
}

export function EventActionSheet({
  event,
  visible,
  timeZone,
  hour12,
  onClose,
  onToggleSchedule,
  onSelectReminder,
}: ActionSheetProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"actions" | "reminder">("actions");
  if (!event) return null;

  function closeSheet() {
    setMode("actions");
    onClose();
  }

  const room = event.room ?? event.location;
  const sourceUrl = event.sourceUrl;
  const locale = currentLocale();
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
                {scheduleFormatter(
                  "dateAndTime",
                  locale,
                  timeZone,
                  hour12,
                ).format(new Date(event.startTime))}
                {event.endTime
                  ? ` ${t("convention.timeRangeTo", {
                      time: formatEventTime(
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
