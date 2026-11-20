import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { ReminderChoices } from "@/components/ReminderChoices";
import { Card, Text } from "@/components/ui";
import { buildConPawsPreviewFixture } from "@/fixtures/conpaws-preview";
import { formatEventTime } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import {
  type OnboardingDestination,
  onboardingExit,
} from "@/lib/onboarding-exit";
import { markOnboardingComplete } from "@/lib/onboarding-storage";
import { REMINDER_DEFAULT_OPTIONS } from "@/lib/reminder-default-storage";

const preview = buildConPawsPreviewFixture();
const event = preview.events[0];
if (!event) throw new Error("The onboarding preview needs a sample event.");

export default function GetStartedScreen() {
  const { t } = useTranslation();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const [reminder, setReminder] = useState<number | null>(null);
  const locale = currentLocale();

  async function finishOnboarding(destination: OnboardingDestination) {
    const exit = onboardingExit(replay, destination);
    if (exit.markComplete) await markOnboardingComplete();
    if (exit.method === "dismissTo") router.dismissTo(exit.href);
    else router.replace(exit.href);
  }

  return (
    <OnboardingFrame
      step={3}
      actions={
        <>
          <OnboardingButton
            label={t("onboarding.getStarted.find")}
            onPress={() => finishOnboarding("/convention/find")}
            testID="onboarding-get-started-find"
          />
          <OnboardingButton
            label={t("onboarding.getStarted.importSchedule")}
            variant="text"
            onPress={() => finishOnboarding("/convention/new/import")}
            testID="onboarding-get-started-import"
          />
          <OnboardingButton
            label={t("onboarding.getStarted.exploreFirst")}
            variant="text"
            onPress={() => finishOnboarding("/(tabs)/(home)")}
            testID="onboarding-get-started-explore"
          />
        </>
      }
    >
      <Text variant="h1" accessibilityRole="header">
        {t("onboarding.getStarted.title")}
      </Text>
      <Text variant="body" className="text-muted-foreground">
        {t("onboarding.getStarted.subtitle")}
      </Text>
      <Card className="gap-3">
        <Text variant="caption" className="text-muted-foreground">
          {t("onboarding.getStarted.example")}
        </Text>
        <Text variant="label">{event.title}</Text>
        <Text variant="caption" className="text-muted-foreground">
          {[
            formatEventTime(
              event.startTime,
              preview.convention.timeZone ?? "UTC",
              locale,
            ),
            event.room,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <ReminderChoices
          label={t("reminders.pickerTitle")}
          value={reminder}
          options={REMINDER_DEFAULT_OPTIONS}
          onChange={setReminder}
          testID="onboarding-sample-reminder"
        />
        <Text variant="caption" className="text-muted-foreground">
          {t("onboarding.getStarted.sampleOnly")}
        </Text>
      </Card>
      <Text variant="caption" className="text-muted-foreground">
        {t("onboarding.getStarted.permissionNote")}
      </Text>
      <Text variant="caption" className="text-muted-foreground">
        {t("onboarding.getStarted.localPrivacy")}
      </Text>
    </OnboardingFrame>
  );
}
