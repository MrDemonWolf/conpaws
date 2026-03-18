import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeView, Text, Button } from '@/components/ui';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeView>
      <View className="flex-1 items-center justify-center px-6 gap-8">
        <View className="items-center gap-3">
          <View className="w-24 h-24 rounded-3xl bg-primary items-center justify-center">
            <Text className="text-4xl text-primary-foreground font-bold">CP</Text>
          </View>
          <Text variant="h1" className="text-primary">
            ConPaws
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            {t('onboarding.welcome.tagline')}
          </Text>
        </View>
        <Text variant="caption" className="text-center">
          {t('onboarding.welcome.subtitle')}
        </Text>
      </View>
      <View className="px-6 pb-8">
        <Button
          size="lg"
          onPress={() => router.push('/(onboarding)/features')}
          className="w-full"
        >
          {t('onboarding.welcome.getStarted')}
        </Button>
      </View>
    </SafeView>
  );
}
