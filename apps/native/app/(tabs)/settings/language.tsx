import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, View } from "react-native";
import { Separator, Text } from "@/components/ui";
import i18n, {
  changeLanguage,
  LANGUAGE_META,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n";

export default function LanguageScreen() {
  const { t } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  async function handleSelect(code: SupportedLanguage) {
    await changeLanguage(code);
    router.back();
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
    >
      {SUPPORTED_LANGUAGES.map((code, index) => {
        const { nativeName, flag } = LANGUAGE_META[code];
        const isSelected = currentLanguage === code;
        const isLast = index === SUPPORTED_LANGUAGES.length - 1;

        return (
          <View key={code}>
            <Pressable
              onPress={() => handleSelect(code)}
              accessibilityRole="radio"
              accessibilityLabel={nativeName}
              accessibilityState={{ checked: isSelected }}
              className="px-4 py-3.5 flex-row items-center justify-between active:opacity-70 bg-card"
            >
              <View className="flex-1 flex-row items-center gap-3">
                <Text variant="body" accessible={false}>
                  {flag}
                </Text>
                <View className="flex-1">
                  <Text
                    variant="body"
                    className={
                      isSelected
                        ? "text-primary font-medium"
                        : "text-foreground"
                    }
                  >
                    {nativeName}
                  </Text>
                  <Text variant="caption" className="text-muted-foreground">
                    {t(`settings.languages.${code}`, {
                      defaultValue: nativeName,
                    })}
                  </Text>
                </View>
              </View>
              {isSelected && (
                <Text
                  variant="body"
                  className="shrink-0 text-primary font-semibold"
                  accessible={false}
                >
                  ✓
                </Text>
              )}
            </Pressable>
            {!isLast && <Separator />}
          </View>
        );
      })}
    </ScrollView>
  );
}
