import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeView, Text, Button } from '@/components/ui';

export default function CompleteScreen() {
  const { t } = useTranslation();

  async function handleLetsGo() {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    router.replace('/(tabs)');
  }

  return (
    <SafeView>
      <View className="flex-1 items-center justify-center px-6 gap-6">
        <View className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 items-center justify-center">
          <Text className="text-4xl">✓</Text>
        </View>
        <View className="items-center gap-2">
          <Text variant="h2" className="text-center">
            {t('onboarding.complete.title')}
          </Text>
          <Text variant="caption" className="text-center">
            {t('onboarding.complete.subtitle')}
          </Text>
        </View>
      </View>
      <View className="px-6 pb-8">
        <Button size="lg" onPress={handleLetsGo} className="w-full">
          {t('onboarding.complete.letsGo')}
        </Button>
      </View>
    </SafeView>
  );
}
