import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { developerToolsEnabled } from "@/lib/developer-tools";
import { ScreenErrorFallback } from "@/lib/error-fallback";

export default function SettingsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const showDeveloperTools = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );

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
      <Stack.Screen
        name="index"
        options={{
          title: t("settings.title"),
        }}
      />
      <Stack.Screen
        name="language"
        options={{ title: t("settings.languages.title") }}
      />
      <Stack.Screen
        name="appearance"
        options={{ title: t("settings.app.theme") }}
      />
      <Stack.Screen
        name="about"
        options={{ title: t("settings.legal.about") }}
      />
      <Stack.Screen
        name="licenses/index"
        options={{ title: t("settings.legal.openSourceLicenses") }}
      />
      <Stack.Screen
        name="licenses/[id]"
        options={{ title: t("settings.licenses.detailsTitle") }}
      />
      <Stack.Protected guard={showDeveloperTools}>
        <Stack.Screen name="debug" options={{ title: "Debug Tools" }} />
        <Stack.Screen name="ui-system" options={{ title: "UI System" }} />
      </Stack.Protected>
    </Stack>
  );
}

// A throw in this layout itself cannot reach the per-screen boundary the root
// layout provides, so it needs its own. Leaf screens under it are already
// covered and keep their chrome.
export const ErrorBoundary = ScreenErrorFallback;
