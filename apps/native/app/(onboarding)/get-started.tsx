import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { CalendarPlus, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, useColorScheme, View } from "react-native";
import { OnboardingBackground } from "@/components/OnboardingBackground";
import { Button, SafeView, Text } from "@/components/ui";

export default function GetStartedScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#18B7F2" : "#006F91";

  async function finishOnboarding(
    destination: "/convention/new/import" | "/(tabs)",
  ) {
    await AsyncStorage.setItem("hasCompletedOnboarding", "true").catch(
      () => undefined,
    );
    router.replace(destination);
  }

  return (
    <SafeView>
      <OnboardingBackground />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 items-center justify-center gap-6 px-6 py-8">
          <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <CalendarPlus size={36} color={iconColor} />
          </View>
          <View className="items-center gap-3">
            <Text variant="h2" className="text-center">
              {t("onboarding.getStarted.title")}
            </Text>
            <Text variant="body" className="text-center text-foreground/80">
              {t("onboarding.getStarted.subtitle")}
            </Text>
          </View>
          <View className="w-full flex-row items-center gap-3 rounded-2xl border border-border bg-card/90 p-4">
            <ShieldCheck size={22} color={iconColor} />
            <Text
              variant="caption"
              className="flex-1 leading-5 text-foreground/80"
            >
              {t("onboarding.getStarted.localPrivacy")}
            </Text>
          </View>
        </View>
        <View className="gap-3 px-6 pb-8">
          <Button
            size="lg"
            onPress={() => finishOnboarding("/convention/new/import")}
            className="w-full"
          >
            {t("onboarding.getStarted.importSchedule")}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onPress={() => finishOnboarding("/(tabs)")}
            className="w-full"
          >
            {t("onboarding.getStarted.exploreFirst")}
          </Button>
        </View>
      </ScrollView>
    </SafeView>
  );
}
