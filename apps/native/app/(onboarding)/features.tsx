import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { OnboardingSlide } from "@/components/OnboardingSlide";
import { Button, SafeView, Text } from "@/components/ui";

export default function FeaturesScreen() {
  const { t } = useTranslation();

  return (
    <SafeView edges={["top", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 48,
          paddingBottom: 16,
        }}
      >
        <View className="items-center mb-8 gap-2">
          <Text variant="h2" className="text-center">
            {t("onboarding.features.title")}
          </Text>
          <Text variant="caption" className="text-center">
            {t("onboarding.features.subtitle")}
          </Text>
        </View>
        <View className="gap-8">
          <OnboardingSlide
            icon={<Text className="text-2xl">📅</Text>}
            title={t("onboarding.features.calendar.title")}
            description={t("onboarding.features.calendar.description")}
          />
          <OnboardingSlide
            icon={<Text className="text-2xl">🤝</Text>}
            title={t("onboarding.features.share.title")}
            description={t("onboarding.features.share.description")}
          />
          <OnboardingSlide
            icon={<Text className="text-2xl">📴</Text>}
            title={t("onboarding.features.offline.title")}
            description={t("onboarding.features.offline.description")}
          />
        </View>
      </ScrollView>
      <View className="px-6 pb-8">
        <Button
          size="lg"
          onPress={() => router.push("/(onboarding)/get-started")}
          className="w-full"
        >
          {t("onboarding.features.next")}
        </Button>
      </View>
    </SafeView>
  );
}
