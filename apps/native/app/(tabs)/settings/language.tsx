import CheckIcon from "@expo/material-symbols/check.xml";
import { FieldGroup, Host, Icon, ListItem, Text as NativeText } from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, useColorScheme } from "react-native";
import i18n, {
  changeLanguage,
  LANGUAGE_META,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n";

const CHECK = Icon.select({ ios: "checkmark", android: CheckIcon });

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const [isChanging, setIsChanging] = useState(false);
  const currentLanguage = i18n.language as SupportedLanguage;

  async function handleSelect(code: SupportedLanguage) {
    if (code === currentLanguage || isChanging) return;

    setIsChanging(true);
    try {
      await changeLanguage(code);
      router.back();
    } catch {
      setIsChanging(false);
      Alert.alert(t("common.error"), t("settings.languages.changeError"));
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
          {SUPPORTED_LANGUAGES.map((code) => {
            const { nativeName, flag } = LANGUAGE_META[code];
            const isSelected = currentLanguage === code;
            const localizedName = t(`settings.languages.${code}`, {
              defaultValue: nativeName,
            });

            return (
              <ListItem
                key={code}
                testID={`language-${code}`}
                leading={
                  <NativeText
                    textStyle={{ fontSize: 22 }}
                    modifiers={[font({ textStyle: "title3" })]}
                  >
                    {flag}
                  </NativeText>
                }
                supportingText={
                  isSelected
                    ? `${localizedName}, ${t("settings.languages.selected")}`
                    : localizedName
                }
                trailing={
                  isSelected ? <Icon name={CHECK} size={18} /> : undefined
                }
                onPress={() => handleSelect(code)}
              >
                {nativeName}
              </ListItem>
            );
          })}
          <FieldGroup.SectionFooter>
            <NativeText modifiers={[font({ textStyle: "footnote" })]}>
              {t("settings.languages.description")}
            </NativeText>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
