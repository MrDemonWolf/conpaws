import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { EventItem } from "@/components/EventItem";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { ScheduleViewSwitcher } from "@/components/schedule/ScheduleViewSwitcher";
import type { ScheduleView } from "@/components/schedule/ScheduleViewSwitcher.types";
import { Text } from "@/components/ui";
import { buildConPawsPreviewFixture } from "@/fixtures/conpaws-preview";
import { formatEventTime } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import { markOnboardingComplete } from "@/lib/onboarding-storage";

const preview = buildConPawsPreviewFixture();
const event = preview.events[0];
if (!event) throw new Error("The onboarding preview needs a sample event.");

export default function FeaturesScreen() {
  const { t } = useTranslation();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<ScheduleView>("all");
  const locale = currentLocale();
  const formatTime = (value: string | null | undefined) =>
    formatEventTime(
      value ?? null,
      preview.convention.timeZone ?? "UTC",
      locale,
    );

  async function handleSkip() {
    if (replay === "1") {
      router.dismissTo("/(tabs)/settings/getting-started");
      return;
    }
    await markOnboardingComplete();
    router.replace("/(tabs)/(home)");
  }

  return (
    <OnboardingFrame
      step={2}
      actions={
        <>
          <OnboardingButton
            label={t("onboarding.features.next")}
            onPress={() =>
              router.push({
                pathname: "/(onboarding)/get-started",
                params: { replay },
              })
            }
            testID="onboarding-features-continue"
          />
          <OnboardingButton
            label={t("onboarding.welcome.skip")}
            variant="text"
            onPress={handleSkip}
            testID="onboarding-features-skip"
          />
        </>
      }
    >
      <Text variant="h1" accessibilityRole="header">
        {t("onboarding.features.title")}
      </Text>
      <Text variant="body" className="text-muted-foreground">
        {t("onboarding.features.subtitle")}
      </Text>
      <View className="overflow-hidden rounded-2xl bg-card py-3">
        <ScheduleViewSwitcher
          view={view}
          onChange={setView}
          labels={{
            all: t("convention.views.all"),
            mine: t("convention.views.mine"),
            now: t("convention.views.now"),
          }}
          accessibilityLabel={t("convention.views.accessibility")}
        />
        {view === "all" || saved ? (
          <EventItem
            title={event.title}
            startTime={formatTime(event.startTime)}
            endTime={formatTime(event.endTime)}
            room={event.room ?? undefined}
            category={event.category ?? undefined}
            isInSchedule={saved}
            interactive={false}
            trailingAction={{
              label: t(
                saved
                  ? "convention.removeFromSchedule"
                  : "convention.addToSchedule",
              ),
              selected: saved,
              onPress: () => setSaved((value) => !value),
              testID: "onboarding-practice-star",
            }}
          />
        ) : (
          <Text variant="body" className="px-4 py-5">
            {t("onboarding.features.emptyPlan")}
          </Text>
        )}
      </View>
      <Text
        variant="caption"
        className="text-primary"
        accessibilityLiveRegion="polite"
      >
        {t("onboarding.features.practiceNote")}
      </Text>
      <Text variant="caption" className="text-muted-foreground">
        {t("onboarding.features.viewsNote")}
      </Text>
    </OnboardingFrame>
  );
}
