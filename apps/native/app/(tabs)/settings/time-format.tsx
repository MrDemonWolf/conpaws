import { FieldGroup, Host } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { settingsChoiceRow } from "@/components/SettingsChoiceRow";
import { useReadableFieldGroup } from "@/hooks/useReadableFieldGroup";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import {
  getTimeFormatPreference,
  saveTimeFormatPreference,
  subscribeTimeFormat,
  type TimeFormatPreference,
} from "@/lib/device-clock";
import { reportError } from "@/lib/error-reporting";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

const CHOICES = ["system", "12", "24"] as const;

export default function TimeFormatScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const colorScheme = useResolvedColorScheme();
  const readableGroup = useReadableFieldGroup();
  const selected = useSyncExternalStore(
    subscribeTimeFormat,
    getTimeFormatPreference,
    getTimeFormatPreference,
  );
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
    <Host
      colorScheme={colorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup {...readableGroup}>
        <FieldGroup.Section disabled={saving}>
          {CHOICES.map((choice) =>
            settingsChoiceRow({
              id: choice,
              testID: `time-format-${choice}`,
              title: t(
                `settings.timeFormat.${choice === "12" ? "hour12" : choice === "24" ? "hour24" : "system"}`,
              ),
              selected: choice === selected,
              indicator: "radio",
              onPress: () => void select(choice),
            }),
          )}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
