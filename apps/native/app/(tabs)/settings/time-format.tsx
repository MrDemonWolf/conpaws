import { FieldGroup } from "@expo/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { settingsChoiceRow } from "@/components/SettingsChoiceRow";
import { SettingsFieldGroupScreen } from "@/components/SettingsFieldGroupScreen";
import {
  saveTimeFormatPreference,
  type TimeFormatPreference,
  timeFormatLabelKey,
  useTimeFormatPreference,
} from "@/lib/device-clock";
import { reportError } from "@/lib/error-reporting";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

const CHOICES = ["system", "12", "24"] as const;

export default function TimeFormatScreen() {
  const { t } = useTranslation();
  const selected = useTimeFormatPreference();
  const [saving, setSaving] = useState(false);

  async function select(next: TimeFormatPreference) {
    if (saving || next === selected) return;
    setSaving(true);
    try {
      await saveTimeFormatPreference(next);
      await publishWidgetSnapshot().catch((error) => {
        reportError(error, { scope: "settings.timeFormat.widgetSnapshot" });
      });
    } catch {
      Alert.alert(t("common.error"), t("settings.timeFormat.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsFieldGroupScreen>
      <FieldGroup.Section disabled={saving}>
        {CHOICES.map((choice) =>
          settingsChoiceRow({
            id: choice,
            testID: `time-format-${choice}`,
            title: t(`settings.timeFormat.${timeFormatLabelKey(choice)}`),
            selected: choice === selected,
            indicator: "radio",
            onPress: () => void select(choice),
          }),
        )}
      </FieldGroup.Section>
    </SettingsFieldGroupScreen>
  );
}
