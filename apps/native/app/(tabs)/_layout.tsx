import { Redirect } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { ScreenErrorFallback } from "@/lib/error-fallback";
import { getCachedOnboardingFlag } from "@/lib/onboarding-storage";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Inbound links resolve straight into the tabs without passing app/index's
  // gate — a widget tap (conpaws://schedule) on a fresh install used to land
  // an un-onboarded user inside the app. The launch bootstrap primes this
  // cache before anything renders, so the read is synchronous; an unprimed
  // cache (fast refresh) falls open rather than re-running onboarding on
  // someone mid-session.
  if (getCachedOnboardingFlag() === false) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return (
    <NativeTabs
      tintColor={colors.primary}
      minimizeBehavior="never"
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="(home)" accessibilityLabel={t("home.title")}>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>{t("home.title")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="schedule"
        accessibilityLabel={t("schedule.title")}
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "star", selected: "star.fill" }}
          md="star"
        />
        <NativeTabs.Trigger.Label>
          {t("schedule.title")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="settings"
        accessibilityLabel={t("common.settings")}
      >
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>
          {t("common.settings")}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// A throw in this layout itself cannot reach the per-screen boundary the root
// layout provides, so it needs its own. Leaf screens under it are already
// covered and keep their chrome.
export const ErrorBoundary = ScreenErrorFallback;
