import { router } from "expo-router";
import { CalendarPlus, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { SafeView, Text } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { markOnboardingComplete } from "@/lib/onboarding-storage";

export default function GetStartedScreen() {
  const { t } = useTranslation();
  const iconColor = useResolvedColorScheme() === "dark" ? "#18B7F2" : "#005575";

  async function finishOnboarding(
    destination: "/convention/new/import" | "/(tabs)/(home)",
  ) {
    await markOnboardingComplete();
    router.replace(destination);
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
          <OnboardingProgress step={3} />
          <View className="flex-1 items-center justify-center gap-5 py-6">
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="h-20 w-20 items-center justify-center rounded-2xl bg-card"
            >
              <CalendarPlus size={34} color={iconColor} />
            </View>
            <View className="max-w-sm items-center gap-2">
              <Text variant="h2" className="text-center">
                {t("onboarding.getStarted.title")}
              </Text>
              <Text
                variant="body"
                className="text-center leading-6 text-muted-foreground"
              >
                {t("onboarding.getStarted.subtitle")}
              </Text>
            </View>
            <View
              accessible
              accessibilityLabel={t("onboarding.getStarted.localPrivacy")}
              className="w-full max-w-sm flex-row items-center gap-3 rounded-2xl bg-card p-4"
            >
              <View
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"
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
        </View>
      </ScrollView>
      <View className="gap-1 px-4 pt-1 pb-2">
        <OnboardingButton
          label={t("onboarding.getStarted.importSchedule")}
          onPress={() => finishOnboarding("/convention/new/import")}
          testID="onboarding-get-started-import"
        />
        <OnboardingButton
          label={t("onboarding.getStarted.exploreFirst")}
          variant="text"
          onPress={() => finishOnboarding("/(tabs)/(home)")}
          testID="onboarding-get-started-explore"
        />
      </View>
    </SafeView>
  );
}
