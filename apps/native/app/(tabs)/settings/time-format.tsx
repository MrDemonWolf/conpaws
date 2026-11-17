import RadioCheckedIcon from "@expo/material-symbols/radio_button_checked.xml";
import RadioUncheckedIcon from "@expo/material-symbols/radio_button_unchecked.xml";
import { FieldGroup, Host, Icon } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { FieldRow } from "@/components/ui/FieldRow";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import {
  getTimeFormatPreference,
  saveTimeFormatPreference,
  subscribeTimeFormat,
  type TimeFormatPreference,
} from "@/lib/device-clock";
import { reportError } from "@/lib/error-reporting";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

const SELECTED = Icon.select({ ios: "checkmark", android: RadioCheckedIcon });
const UNSELECTED = Icon.select({ ios: "circle", android: RadioUncheckedIcon });
const CHOICES = ["system", "12", "24"] as const;

export default function TimeFormatScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const colorScheme = useResolvedColorScheme();
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
      <FieldGroup>
        <FieldGroup.Section disabled={saving}>
          {CHOICES.map((choice) => (
            <FieldRow
              key={`${choice}-${choice === selected}`}
              testID={`time-format-${choice}`}
              trailing={
                <Icon
                  name={choice === selected ? SELECTED : UNSELECTED}
                  size={18}
                />
              }
              onPress={() => void select(choice)}
            >
              {t(
                `settings.timeFormat.${choice === "12" ? "hour12" : choice === "24" ? "hour24" : "system"}`,
              )}
            </FieldRow>
          ))}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
