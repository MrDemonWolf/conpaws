import { router } from "expo-router";
import { Cloud, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, useColorScheme, View } from "react-native";
import { EventItem } from "@/components/EventItem";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { SectionHeader } from "@/components/SectionHeader";
import { SafeView, Text } from "@/components/ui";
import { buildConPawsPreviewFixture } from "@/fixtures/conpaws-preview";

const previewFixture = buildConPawsPreviewFixture();
const previewEvents = previewFixture.events.slice(0, 2);

function formatTime(value: string | null | undefined, locale: string): string {
  if (!value) return "";

  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: previewFixture.convention.timeZone ?? "UTC",
  }).format(new Date(value));
}

export default function FeaturesScreen() {
  const { i18n, t } = useTranslation();
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === "dark" ? "#18B7F2" : "#006F91";
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en";

  return (
    <SafeView
      edges={["top", "bottom"]}
      className="overflow-hidden bg-background"
    >
      <ScrollView
        className="flex-1"
        alwaysBounceVertical={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 8,
        }}
        overScrollMode="never"
      >
        <View className="flex-1">
          <OnboardingProgress step={2} />
          <View className="flex-1 justify-center gap-5 py-5">
            <View className="items-center gap-2">
              <Text variant="h2" className="text-center">
                {t("onboarding.features.title")}
              </Text>
              <Text
                variant="caption"
                className="max-w-sm text-center leading-5 text-muted-foreground"
              >
                {t("onboarding.features.subtitle")}
              </Text>
            </View>
            <View className="overflow-hidden rounded-2xl bg-card">
              <SectionHeader
                title={t("onboarding.features.demo.saved")}
                className="bg-card pt-4"
              />
              {previewEvents.map((event) => (
                <EventItem
                  key={event.id}
                  title={event.title}
                  startTime={formatTime(event.startTime, locale)}
                  endTime={formatTime(event.endTime, locale)}
                  room={event.room ?? undefined}
                  category={event.category ?? undefined}
                  isInSchedule
                  hasConflict
                  interactive={false}
                  className="bg-card"
                />
              ))}
              <View
                accessible
                accessibilityLabel={`${t("onboarding.features.offline.title")}. ${t("onboarding.features.offline.description")}`}
                className="flex-row items-center gap-2 border-border border-t px-4 py-3"
              >
                <ShieldCheck size={17} color={iconColor} />
                <Text variant="caption" className="flex-1">
                  {t("onboarding.features.offline.title")}
                </Text>
              </View>
            </View>
            <View className="items-center gap-1">
              <Text variant="label" className="text-center">
                {t("onboarding.features.plan.title")}
              </Text>
              <Text variant="caption" className="text-center leading-5">
                {t("onboarding.features.plan.description")}
              </Text>
            </View>
            <View
              accessible
              accessibilityLabel={`${t("onboarding.features.plus.eyebrow")}. ${t("onboarding.features.plus.title")}. ${t("onboarding.features.plus.description")}`}
              className="flex-row items-center justify-center gap-2"
            >
              <Cloud size={16} color={iconColor} />
              <Text variant="caption" className="font-semibold text-primary">
                {t("onboarding.features.plus.eyebrow")}:{" "}
                {t("onboarding.features.plus.title")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <View className="px-4 pt-1 pb-2">
        <OnboardingButton
          label={t("onboarding.features.next")}
          onPress={() => router.push("/(onboarding)/get-started")}
          testID="onboarding-features-continue"
        />
      </View>
    </SafeView>
  );
}
