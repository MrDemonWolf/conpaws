import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeView, Text, Separator } from '@/components/ui';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  changeLanguage,
  type SupportedLanguage,
} from '@/lib/i18n';
import i18n from '@/lib/i18n';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  async function handleSelect(code: SupportedLanguage) {
    await changeLanguage(code);
    router.back();
  }

  return (
    <SafeView edges={['top', 'bottom']}>
      <View className="px-4 py-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Text variant="body" className="text-primary">
            ‹ {t('common.back')}
          </Text>
        </Pressable>
        <Text variant="h2">{t('settings.languages.title')}</Text>
      </View>

      <ScrollView className="flex-1">
        {SUPPORTED_LANGUAGES.map((code, index) => {
          const { nativeName, flag } = LANGUAGE_META[code];
          const isSelected = currentLanguage === code;
          const isLast = index === SUPPORTED_LANGUAGES.length - 1;

          return (
            <View key={code}>
              <Pressable
                onPress={() => handleSelect(code)}
                className="px-4 py-3.5 flex-row items-center justify-between active:opacity-70 bg-card"
              >
                <View className="flex-row items-center gap-3">
                  <Text variant="body">{flag}</Text>
                  <View>
                    <Text variant="body" className={isSelected ? 'text-primary font-medium' : 'text-foreground'}>
                      {nativeName}
                    </Text>
                    <Text variant="caption" className="text-muted-foreground">
                      {t(`settings.languages.${code}`, { defaultValue: nativeName })}
                    </Text>
                  </View>
                </View>
                {isSelected && (
                  <Text variant="body" className="text-primary font-semibold">
                    ✓
                  </Text>
                )}
              </Pressable>
              {!isLast && <Separator />}
            </View>
          );
        })}
      </ScrollView>
    </SafeView>
  );
}
