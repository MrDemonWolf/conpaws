import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { CalendarPlus, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, useColorScheme, View } from "react-native";
import { OnboardingBackground } from "@/components/OnboardingBackground";
import { OnboardingButton } from "@/components/OnboardingButton";
import { SafeView, Text } from "@/components/ui";

export default function GetStartedScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#18B7F2" : "#006F91";

  async function finishOnboarding(
    destination: "/convention/new/import" | "/(tabs)/(home)",
  ) {
    await AsyncStorage.setItem("hasCompletedOnboarding", "true").catch(
      () => undefined,
    );
    router.replace(destination);
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
        <View className="flex-grow items-center justify-center gap-6 py-8">
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/10"
          >
            <CalendarPlus size={36} color={iconColor} />
          </View>
          <View className="max-w-sm items-center gap-2">
            <Text variant="h2" className="text-center">
              {t("onboarding.getStarted.title")}
            </Text>
            <Text variant="body" className="text-center text-muted-foreground">
              {t("onboarding.getStarted.subtitle")}
            </Text>
          </View>
          <View
            accessible
            accessibilityLabel={t("onboarding.getStarted.localPrivacy")}
            className="w-full max-w-xl flex-row items-start gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <ShieldCheck size={22} color={iconColor} />
            </View>
            <Text
              variant="caption"
              className="flex-1 leading-5 text-muted-foreground"
            >
              {t("onboarding.getStarted.localPrivacy")}
            </Text>
          </View>
        </View>
        <View className="gap-3 pt-4">
          <OnboardingButton
            label={t("onboarding.getStarted.importSchedule")}
            onPress={() => finishOnboarding("/convention/new/import")}
          />
          <OnboardingButton
            label={t("onboarding.getStarted.exploreFirst")}
            variant="secondary"
            onPress={() => finishOnboarding("/(tabs)/(home)")}
          />
        </View>
      </ScrollView>
    </SafeView>
  );
}
