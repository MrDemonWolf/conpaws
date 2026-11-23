import ContrastIcon from "@expo/material-symbols/contrast.xml";
import DarkModeIcon from "@expo/material-symbols/dark_mode.xml";
import LightModeIcon from "@expo/material-symbols/light_mode.xml";
import { FieldGroup, Icon } from "@expo/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { settingsChoiceRow } from "@/components/SettingsChoiceRow";
import { SettingsFieldGroupScreen } from "@/components/SettingsFieldGroupScreen";
import { settingsFooter } from "@/components/SettingsFooter";
import {
  APPEARANCE_PREFERENCES,
  type AppearancePreference,
} from "@/lib/appearance";
import {
  applyAppearancePreference,
  getAppearancePreference,
  saveAppearancePreference,
} from "@/lib/appearance-storage";
import { reportError } from "@/lib/error-reporting";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

const APPEARANCE_ICONS: Record<
  AppearancePreference,
  ReturnType<typeof Icon.select>
> = {
  system: Icon.select({ ios: "circle.lefthalf.filled", android: ContrastIcon }),
  light: Icon.select({ ios: "sun.max.fill", android: LightModeIcon }),
  dark: Icon.select({ ios: "moon.fill", android: DarkModeIcon }),
};

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const [appearance, setAppearance] = useState<AppearancePreference>(
    getAppearancePreference,
  );
  const [isChanging, setIsChanging] = useState(false);

  function handleSelect(next: AppearancePreference) {
    if (next === appearance || isChanging) return;

    const previous = appearance;
    setIsChanging(true);
    setAppearance(next);

    void saveAppearancePreference(next)
      .then(async () => {
        applyAppearancePreference(next);
        await publishWidgetSnapshot().catch((error) => {
          reportError(error, { scope: "settings.appearance.widgetSnapshot" });
        });
      })
      .catch(() => {
        setAppearance(previous);
        Alert.alert(t("common.error"), t("settings.appearance.changeError"));
      })
      .finally(() => setIsChanging(false));
  }

  return (
    <SettingsFieldGroupScreen>
      <FieldGroup.Section disabled={isChanging}>
        {APPEARANCE_PREFERENCES.map((preference) => {
          const isSelected = appearance === preference;

          return settingsChoiceRow({
            id: preference,
            testID: `appearance-${preference}`,
            title: t(`settings.appearance.${preference}`),
            selected: isSelected,
            indicator: "check",
            leading: <Icon name={APPEARANCE_ICONS[preference]} size={22} />,
            supportingText: isSelected
              ? t("settings.languages.selected")
              : undefined,
            onPress: () => handleSelect(preference),
          });
        })}
        {settingsFooter(t("settings.appearance.description"))}
      </FieldGroup.Section>
    </SettingsFieldGroupScreen>
  );
}
