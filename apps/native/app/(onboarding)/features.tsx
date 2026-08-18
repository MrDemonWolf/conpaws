import { router } from "expo-router";
import {
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Cloud,
  ShieldCheck,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, useColorScheme, View } from "react-native";
import { OnboardingBackground } from "@/components/OnboardingBackground";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingSlide } from "@/components/OnboardingSlide";
import { SafeView, Text } from "@/components/ui";

export default function FeaturesScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#18B7F2" : "#006F91";

  return (
    <SafeView edges={["top", "bottom"]} className="overflow-hidden">
      <OnboardingBackground />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 24,
        }}
      >
        <View className="mb-8 items-center gap-2">
          <Text variant="h2" className="text-center">
            {t("onboarding.features.title")}
          </Text>
          <Text variant="caption" className="text-center text-foreground/80">
            {t("onboarding.features.subtitle")}
          </Text>
        </View>
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`${t("onboarding.features.demo.saved")}. 10:00, ${t("onboarding.features.demo.eventOne")}, ${t("onboarding.features.demo.now")}. 11:30, ${t("onboarding.features.demo.eventTwo")}, ${t("onboarding.features.demo.next")}.`}
          className="mb-6 rounded-3xl border border-border bg-card/95 p-4"
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text variant="label">{t("onboarding.features.demo.saved")}</Text>
            <View className="rounded-full bg-primary/10 px-3 py-1">
              <Text variant="caption" className="font-medium text-foreground">
                {t("onboarding.features.offline.title")}
              </Text>
            </View>
          </View>
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <Text
                variant="caption"
                className="min-w-12 shrink-0 font-semibold text-primary"
              >
                10:00
              </Text>
              <View className="h-11 w-1 rounded-full bg-primary" />
              <View className="flex-1 gap-0.5">
                <Text variant="label">
                  {t("onboarding.features.demo.eventOne")}
                </Text>
                <Text variant="caption" className="text-foreground/80">
                  {t("onboarding.features.demo.now")}
                </Text>
              </View>
              <CheckCircle2 size={18} color={iconColor} />
            </View>
            <View className="flex-row items-center gap-3">
              <Text
                variant="caption"
                className="min-w-12 shrink-0 font-semibold text-foreground/80"
              >
                11:30
              </Text>
              <View className="h-11 w-1 rounded-full bg-border" />
              <View className="flex-1 gap-0.5">
                <Text variant="label">
                  {t("onboarding.features.demo.eventTwo")}
                </Text>
                <Text variant="caption" className="text-foreground/80">
                  {t("onboarding.features.demo.next")}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View className="gap-3">
          <OnboardingSlide
            icon={<CalendarPlus size={24} color={iconColor} />}
            title={t("onboarding.features.import.title")}
            description={t("onboarding.features.import.description")}
          />
          <OnboardingSlide
            icon={<Clock3 size={24} color={iconColor} />}
            title={t("onboarding.features.plan.title")}
            description={t("onboarding.features.plan.description")}
          />
          <OnboardingSlide
            icon={<ShieldCheck size={24} color={iconColor} />}
            title={t("onboarding.features.offline.title")}
            description={t("onboarding.features.offline.description")}
          />
          <View className="flex-row gap-4 rounded-2xl border border-dashed border-border bg-card/95 p-4">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Cloud size={24} color={iconColor} />
            </View>
            <View className="flex-1 gap-1">
              <Text variant="caption" className="font-semibold text-primary">
                {t("onboarding.features.plus.eyebrow")}
              </Text>
              <Text variant="body" className="font-semibold">
                {t("onboarding.features.plus.title")}
              </Text>
              <Text variant="caption" className="leading-5 text-foreground/80">
                {t("onboarding.features.plus.description")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <View className="px-6 pb-8">
        <OnboardingButton
          label={t("onboarding.features.next")}
          onPress={() => router.push("/(onboarding)/get-started")}
        />
      </View>
    </SafeView>
  );
}
