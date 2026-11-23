import { FieldGroup } from "@expo/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { settingsChoiceRow } from "@/components/SettingsChoiceRow";
import { SettingsFieldGroupScreen } from "@/components/SettingsFieldGroupScreen";
import { settingsFooter } from "@/components/SettingsFooter";
import { reminderDefaultLabel } from "@/lib/reminder-default-label";
import {
  getCachedDefaultReminderMinutes,
  getDefaultReminderMinutes,
  REMINDER_DEFAULT_OPTIONS,
  setDefaultReminderMinutes,
} from "@/lib/reminder-default-storage";

/** "No default" first, then the lead times in order. */
const CHOICES: Array<number | null> = [null, ...REMINDER_DEFAULT_OPTIONS];

/**
 * Picks the lead time new leave reminders start from.
 *
 * Android, and iOS at accessibility text sizes, reach this from a Settings
 * row. It used to be an `@expo/ui` `<Picker>` inline in Settings, which on
 * Android renders a Material 3 `ExposedDropdownMenuBox` whose anchor is a bare
 * `TextField` -- unlabelled, sized to its own content rather than the row, and
 * trailing an underline past its own edge. The universal Picker exposes no
 * `style` and no `label`, so there was nothing to set. Theme and Language already answer the same
 * question with a pushed list of rows, and Material selects from a list this
 * way regardless, so this follows them.
 *
 * Below accessibility text sizes (`SETTINGS_STACKED_FONT_SCALE`) iOS keeps the
 * compact SwiftUI menu in the Settings row's trailing slot instead.
 */
export default function ReminderDefaultScreen() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(
    getCachedDefaultReminderMinutes,
  );
  const [isSaving, setIsSaving] = useState(false);

  // The cache is empty on a cold open straight to this screen.
  useEffect(() => {
    void getDefaultReminderMinutes().then(setSelected);
  }, []);

  function handleSelect(next: number | null) {
    if (next === selected || isSaving) return;
    const previous = selected;
    setIsSaving(true);
    setSelected(next);
    void setDefaultReminderMinutes(next)
      .catch(() => {
        setSelected(previous);
        Alert.alert(
          t("common.error"),
          t("settings.notifications.defaultLeadError"),
        );
      })
      .finally(() => setIsSaving(false));
  }

  return (
    <SettingsFieldGroupScreen>
      <FieldGroup.Section disabled={isSaving}>
        {CHOICES.map((minutes) =>
          settingsChoiceRow({
            id: minutes,
            testID: `reminder-default-${minutes ?? "none"}`,
            title: reminderDefaultLabel(minutes, t),
            selected: minutes === selected,
            indicator: "radio",
            onPress: () => handleSelect(minutes),
          }),
        )}
        {settingsFooter(t("settings.notifications.defaultLeadDescription"))}
      </FieldGroup.Section>
    </SettingsFieldGroupScreen>
  );
}
