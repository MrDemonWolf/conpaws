import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, View } from "react-native";
import { OnboardingBackground } from "@/components/OnboardingBackground";
import { OnboardingButton } from "@/components/OnboardingButton";
import { SafeView, Text } from "@/components/ui";

export default function WelcomeScreen() {
  const { t } = useTranslation();

  async function handleSkip() {
    await AsyncStorage.setItem("hasCompletedOnboarding", "true").catch(
      () => undefined,
    );
    router.replace("/(tabs)/(home)");
  }

  return (
    <SafeView className="overflow-hidden">
      <OnboardingBackground />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-grow items-center justify-center py-8">
          <View className="max-w-sm items-center gap-6">
            <View className="items-center gap-1">
              <Image
                source={require("../../assets/images/splash-icon.png")}
                className="h-40 w-40"
                resizeMode="contain"
                accessible={false}
                accessibilityIgnoresInvertColors
              />
              <Text
                variant="h1"
                className="text-4xl tracking-tight text-primary"
              >
                ConPaws
              </Text>
            </View>
            <View className="items-center gap-2">
              <Text variant="body" className="text-center font-semibold">
                {t("onboarding.welcome.tagline")}
              </Text>
              <Text
                variant="caption"
                className="text-center leading-5 text-muted-foreground"
              >
                {t("onboarding.welcome.subtitle")}
              </Text>
            </View>
          </View>
        </View>
        <View className="gap-2 pt-4">
          <OnboardingButton
            label={t("onboarding.welcome.continue")}
            onPress={() => router.push("/(onboarding)/features")}
          />
          <OnboardingButton
            label={t("onboarding.welcome.skip")}
            variant="text"
            onPress={handleSkip}
          />
        </View>
      </ScrollView>
    </SafeView>
  );
}
