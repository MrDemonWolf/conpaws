import { useTheme } from "expo-router/react-navigation";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { ScreenErrorFallback } from "@/lib/error-fallback";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

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
