import CheckIcon from "@expo/material-symbols/check.xml";
import ContrastIcon from "@expo/material-symbols/contrast.xml";
import DarkModeIcon from "@expo/material-symbols/dark_mode.xml";
import LightModeIcon from "@expo/material-symbols/light_mode.xml";
import { FieldGroup, Host, Icon } from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "expo-router/react-navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { FieldRow } from "@/components/ui/FieldRow";
import { NativeText } from "@/components/ui/NativeText";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import {
  APPEARANCE_PREFERENCES,
  type AppearancePreference,
} from "@/lib/appearance";
import {
  applyAppearancePreference,
  getAppearancePreference,
  saveAppearancePreference,
} from "@/lib/appearance-storage";

const CHECK = Icon.select({ ios: "checkmark", android: CheckIcon });
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
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();
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
      .then(() => applyAppearancePreference(next))
      .catch(() => {
        setAppearance(previous);
        Alert.alert(t("common.error"), t("settings.appearance.changeError"));
      })
      .finally(() => setIsChanging(false));
  }

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section disabled={isChanging}>
          {APPEARANCE_PREFERENCES.map((preference) => {
            const isSelected = appearance === preference;

            return (
              <FieldRow
                // Selected state is in the key because @expo/ui's Android
                // ListItem mounts its `trailing` slot once and then leaves it
                // alone: it unmounts a slot that becomes `undefined` but never
                // mounts a new one, so the checkmark vanished off the old row
                // and never appeared on the new one. Remounting the two rows
                // that flipped is what makes the tick move. Verified on the
                // reminder-default screen, which had the identical bug.
                key={`${preference}-${isSelected}`}
                testID={`appearance-${preference}`}
                leading={<Icon name={APPEARANCE_ICONS[preference]} size={22} />}
                supportingText={
                  isSelected ? t("settings.languages.selected") : undefined
                }
                trailing={
                  isSelected ? <Icon name={CHECK} size={18} /> : undefined
                }
                onPress={() => handleSelect(preference)}
              >
                {t(`settings.appearance.${preference}`)}
              </FieldRow>
            );
          })}
          <FieldGroup.SectionFooter>
            <NativeText modifiers={[font({ textStyle: "footnote" })]}>
              {t("settings.appearance.description")}
            </NativeText>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
