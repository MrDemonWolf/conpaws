import CheckIcon from "@expo/material-symbols/check.xml";
import { FieldGroup, Host, Icon, ListItem, Text as NativeText } from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import i18n, {
  changeLanguage,
  LANGUAGE_META,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n";
import { recordReminderReconciliation } from "@/lib/reminder-notice";
import { reconcileEventReminders } from "@/services/notifications";

const CHECK = Icon.select({ ios: "checkmark", android: CheckIcon });

/**
 * A language is not a country, but a flag is the fastest visual anchor in a
 * list of native names. The pick is the variant the app actually ships:
 * pt-BR is Brazilian Portuguese, en is US English.
 */
const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  de: "🇩🇪",
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  nl: "🇳🇱",
  pl: "🇵🇱",
  "pt-BR": "🇧🇷",
  sv: "🇸🇪",
};

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();
  const [isChanging, setIsChanging] = useState(false);
  const currentLanguage = i18n.language as SupportedLanguage;

  async function handleSelect(code: SupportedLanguage) {
    if (code === currentLanguage || isChanging) return;

    setIsChanging(true);
    try {
      await changeLanguage(code);
      // A pending reminder carries the title and body that were composed when
      // it was scheduled, so its text stays in the old language until
      // something rewrites the OS request. Reconciling here is what makes
      // tonight's reminder arrive in the language just chosen instead of only
      // after the next cold start.
      const reconciliation = await reconcileEventReminders().catch(() => null);
      if (reconciliation) recordReminderReconciliation(reconciliation);
      router.back();
    } catch {
      setIsChanging(false);
      Alert.alert(t("common.error"), t("settings.languages.changeError"));
    }
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
          {SUPPORTED_LANGUAGES.map((code) => {
            const { nativeName } = LANGUAGE_META[code];
            const isSelected = currentLanguage === code;
            const localizedName = t(`settings.languages.${code}`, {
              defaultValue: nativeName,
            });
            const supportingText = [
              localizedName === nativeName ? null : localizedName,
              isSelected ? t("settings.languages.selected") : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <ListItem
                key={code}
                testID={`language-${code}`}
                supportingText={supportingText || undefined}
                trailing={
                  isSelected ? <Icon name={CHECK} size={18} /> : undefined
                }
                onPress={() => handleSelect(code)}
              >
                {`${LANGUAGE_FLAGS[code]}  ${nativeName}`}
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
