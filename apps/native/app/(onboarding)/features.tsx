import { router } from "expo-router";
import {
  CalendarPlus,
  CloudOff,
  type LucideIcon,
  ShieldCheck,
  Star,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { EventItem } from "@/components/EventItem";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { SectionHeader } from "@/components/SectionHeader";
import { SafeView, Text } from "@/components/ui";
import { buildConPawsPreviewFixture } from "@/fixtures/conpaws-preview";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { formatEventTime } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import { markOnboardingComplete } from "@/lib/onboarding-storage";
import { themeTokens } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";

const previewFixture = buildConPawsPreviewFixture();
const previewEvents = previewFixture.events.slice(0, 2);

function FeatureRow({
  Icon,
  title,
  description,
  color,
  className,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  className?: string;
}) {
  return (
    <View className={cn("flex-row items-start gap-3", className)}>
      <Icon size={20} color={color} />
      <View className="flex-1 gap-0.5">
        <Text variant="label">{title}</Text>
        <Text variant="caption" className="text-muted-foreground">
          {description}
        </Text>
      </View>
    </View>
  );
}

function formatTime(value: string | null | undefined, locale: string): string {
  if (!value) return "";

  return formatEventTime(
    value,
    previewFixture.convention.timeZone ?? "UTC",
    locale,
  );
}

export default function FeaturesScreen() {
  const { t } = useTranslation();

  async function handleSkip() {
    await markOnboardingComplete();
    router.replace("/(tabs)/(home)");
  }

  const iconColor = themeTokens[useResolvedColorScheme()].primary;
  const locale = currentLocale();

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
                className="max-w-sm text-center text-muted-foreground"
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
              <FeatureRow
                Icon={ShieldCheck}
                color={iconColor}
                title={t("onboarding.features.offline.title")}
                description={t("onboarding.features.offline.description")}
                className="border-border border-t px-4 py-3"
              />
            </View>
            {/* These strings shipped translated in all 22 locales and
                were rendered nowhere — the only in-app explanation of what
                "import" means. */}
            <FeatureRow
              Icon={CalendarPlus}
              color={iconColor}
              title={t("onboarding.features.import.title")}
              description={t("onboarding.features.import.description")}
            />
            <FeatureRow
              Icon={Star}
              color={iconColor}
              title={t("onboarding.features.plan.title")}
              description={t("onboarding.features.plan.description")}
            />
            <FeatureRow
              Icon={CloudOff}
              color={iconColor}
              title={t("onboarding.features.plus.title")}
              description={t("onboarding.features.plus.description")}
            />
          </View>
        </View>
      </ScrollView>
      <View className="gap-1 px-4 pt-1 pb-2">
        <OnboardingButton
          label={t("onboarding.features.next")}
          onPress={() => router.push("/(onboarding)/get-started")}
          testID="onboarding-features-continue"
        />
        <OnboardingButton
          label={t("onboarding.welcome.skip")}
          variant="text"
          onPress={handleSkip}
          testID="onboarding-features-skip"
        />
      </View>
    </SafeView>
  );
}
