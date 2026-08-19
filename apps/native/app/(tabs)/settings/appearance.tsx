import CheckIcon from "@expo/material-symbols/check.xml";
import { FieldGroup, Host, Icon, ListItem, Text as NativeText } from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "expo-router/react-navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, useColorScheme } from "react-native";
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

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const [appearance, setAppearance] = useState<AppearancePreference>(
    getAppearancePreference,
  );
  const [isChanging, setIsChanging] = useState(false);

  async function handleSelect(next: AppearancePreference) {
    if (next === appearance || isChanging) return;

    const previous = appearance;
    setIsChanging(true);
    setAppearance(next);

    try {
      await saveAppearancePreference(next);
      applyAppearancePreference(next);
    } catch {
      setAppearance(previous);
      Alert.alert(t("common.error"), t("settings.appearance.changeError"));
    } finally {
      setIsChanging(false);
    }
  }

  return (
    <Host
      colorScheme={colorScheme === "dark" ? "dark" : "light"}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section disabled={isChanging}>
          {APPEARANCE_PREFERENCES.map((preference) => {
            const isSelected = appearance === preference;

            return (
              <ListItem
                key={preference}
                testID={`appearance-${preference}`}
                supportingText={
                  isSelected ? t("settings.languages.selected") : undefined
                }
                trailing={
                  isSelected ? <Icon name={CHECK} size={18} /> : undefined
                }
                onPress={() => handleSelect(preference)}
              >
                {t(`settings.appearance.${preference}`)}
              </ListItem>
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
