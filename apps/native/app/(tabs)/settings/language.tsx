import { FieldGroup } from "@expo/ui";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { settingsChoiceRow } from "@/components/SettingsChoiceRow";
import { SettingsFieldGroupScreen } from "@/components/SettingsFieldGroupScreen";
import { settingsFooter } from "@/components/SettingsFooter";
import { reportError } from "@/lib/error-reporting";
import i18n, {
  changeLanguage,
  LANGUAGE_META,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n";
import { recordReminderReconciliation } from "@/lib/reminder-notice";
import { reconcileEventReminders } from "@/services/notifications";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

/**
 * A language is not a country, but a flag is the fastest visual anchor in a
 * list of native names. The pick is the variant the app actually ships:
 * pt-BR is Brazilian Portuguese, es-419 shows Mexico for Latin American
 * Spanish, en is US English.
 */
const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: "🇺🇸",
  "es-419": "🇲🇽",
  "es-ES": "🇪🇸",
  "pt-BR": "🇧🇷",
  "pt-PT": "🇵🇹",
  ja: "🇯🇵",
  "zh-TW": "🇹🇼",
  "zh-CN": "🇨🇳",
  ko: "🇰🇷",
  de: "🇩🇪",
  fr: "🇫🇷",
  pl: "🇵🇱",
  it: "🇮🇹",
  nl: "🇳🇱",
  ms: "🇲🇾",
  sv: "🇸🇪",
  da: "🇩🇰",
  nb: "🇳🇴",
  fi: "🇫🇮",
  cs: "🇨🇿",
  hu: "🇭🇺",
  uk: "🇺🇦",
  ru: "🇷🇺",
};

export default function LanguageScreen() {
  const { t } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);
  const currentLanguage = i18n.language as SupportedLanguage;

  async function handleSelect(code: SupportedLanguage) {
    if (code === currentLanguage || isChanging) return;

    setIsChanging(true);
    try {
      await changeLanguage(code);
      await publishWidgetSnapshot().catch((error) => {
        reportError(error, { scope: "settings.language.widgetSnapshot" });
      });
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
    <SettingsFieldGroupScreen>
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

          return settingsChoiceRow({
            id: code,
            testID: `language-${code}`,
            title: `${LANGUAGE_FLAGS[code]}  ${nativeName}`,
            selected: isSelected,
            indicator: "check",
            supportingText: supportingText || undefined,
            onPress: () => handleSelect(code),
          });
        })}
        {settingsFooter(t("settings.languages.description"))}
      </FieldGroup.Section>
    </SettingsFieldGroupScreen>
  );
}
