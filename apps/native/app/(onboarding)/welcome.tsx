import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";
import { OnboardingButton } from "@/components/OnboardingButton";
import { OnboardingFrame } from "@/components/OnboardingFrame";
import { Card, Text } from "@/components/ui";
import { buildConPawsPreviewFixture } from "@/fixtures/conpaws-preview";
import { formatConventionDate } from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";
import { markOnboardingComplete } from "@/lib/onboarding-storage";

const preview = buildConPawsPreviewFixture().convention;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const locale = currentLocale();

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
      step={1}
      actions={
        <>
          <OnboardingButton
            label={t("onboarding.welcome.continue")}
            onPress={() =>
              router.push({
                pathname: "/(onboarding)/features",
                params: { replay },
              })
            }
            testID="onboarding-welcome-continue"
          />
          <OnboardingButton
            label={t("onboarding.welcome.skip")}
            variant="text"
            onPress={handleSkip}
            testID="onboarding-welcome-skip"
          />
        </>
      }
    >
      <View className="flex-row items-center gap-3">
        <Image
          source={require("../../assets/images/splash-icon.png")}
          style={{ width: 44, height: 44 }}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
        />
        <Text variant="label" className="font-semibold">
          ConPaws
        </Text>
      </View>
      <Text variant="h1" accessibilityRole="header">
        {t("onboarding.welcome.tagline")}
      </Text>
      <Text variant="body" className="text-muted-foreground">
        {t("onboarding.welcome.subtitle")}
      </Text>
      <Card className="gap-2">
        <Text variant="caption" className="text-muted-foreground">
          {t("onboarding.welcome.exampleTitle")}
        </Text>
        <Text variant="label">{preview.name}</Text>
        <Text variant="caption" className="text-muted-foreground">
          {t("home.dateRange", {
            start: formatConventionDate(preview.startDate, locale),
            end: formatConventionDate(preview.endDate, locale),
          })}
        </Text>
      </Card>
      <Text variant="caption" className="text-muted-foreground">
        {t("onboarding.welcome.connectionNote")}
      </Text>
    </OnboardingFrame>
  );
}
