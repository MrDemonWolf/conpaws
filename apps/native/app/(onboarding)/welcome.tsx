import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, View } from "react-native";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { SafeView, Text } from "@/components/ui";
import { markOnboardingComplete } from "@/lib/onboarding-storage";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  async function handleSkip() {
    await markOnboardingComplete();
    router.replace("/(tabs)/(home)");
  }

  return (
    <SafeView className="overflow-hidden bg-background">
      <ScrollView
        className="flex-1"
        alwaysBounceVertical={false}
        bounces={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
        }}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1">
          <OnboardingProgress step={1} />
          <View className="flex-1 items-center justify-center py-6">
            <View className="w-full max-w-sm items-center gap-5">
              <Image
                source={require("../../assets/images/splash-icon.png")}
                style={{ width: 112, height: 112 }}
                resizeMode="contain"
                accessible={false}
                accessibilityIgnoresInvertColors
              />
              <View className="items-center gap-3">
                <Text variant="h1" className="tracking-tight text-primary">
                  ConPaws
                </Text>
                <Text variant="body" className="text-center font-semibold">
                  {t("onboarding.welcome.tagline")}
                </Text>
                <Text
                  variant="caption"
                  className="max-w-xs text-center leading-5 text-muted-foreground"
                >
                  {t("onboarding.welcome.subtitle")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <View className="gap-1 px-4 pt-1 pb-2">
        <OnboardingButton
          label={t("onboarding.welcome.continue")}
          onPress={() => router.push("/(onboarding)/features")}
          testID="onboarding-welcome-continue"
        />
        <OnboardingButton
          label={t("onboarding.welcome.skip")}
          variant="text"
          onPress={handleSkip}
          testID="onboarding-welcome-skip"
        />
      </View>
    </SafeView>
  );
}
