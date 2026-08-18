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
    <SafeView>
      <OnboardingBackground />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center gap-8 px-6 py-8">
          <View className="items-center gap-4">
            <Image
              source={require("../../assets/images/splash-icon.png")}
              className="h-40 w-40"
              resizeMode="contain"
              accessible={false}
              accessibilityIgnoresInvertColors
            />
            <Text variant="h1" className="text-4xl tracking-tight text-primary">
              ConPaws
            </Text>
            <Text variant="body" className="text-center font-semibold">
              {t("onboarding.welcome.tagline")}
            </Text>
            <Text
              variant="caption"
              className="text-center leading-5 text-foreground/80"
            >
              {t("onboarding.welcome.subtitle")}
            </Text>
          </View>
        </View>
        <View className="gap-2 px-6 pb-8">
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
