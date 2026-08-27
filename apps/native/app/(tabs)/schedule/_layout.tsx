import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { ScreenErrorFallback } from "@/lib/error-fallback";

export default function ScheduleLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerLargeTitleEnabled: process.env.EXPO_OS === "ios",
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen name="index" options={{ title: t("schedule.title") }} />
    </Stack>
  );
}

// A throw in this layout itself cannot reach the per-screen boundary the root
// layout provides, so it needs its own. Leaf screens under it are already
// covered and keep their chrome.
export const ErrorBoundary = ScreenErrorFallback;
