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

  /**
   * Options for the screens whose content is an `@expo/ui` `Host`.
   *
   * UIKit wires a navigation bar's large-title collapse and its scroll-edge
   * background to a scroll view it can see. The SwiftUI `List` inside a `Host`
   * is not that view, so the bar stayed in its scrolled-to-top appearance
   * forever: transparent, and on About the large title never collapsed at all.
   * Content then slid under the bar and drew straight through the title -- the
   * app icon crossed the words "About ConPaws", and Settings' rows crossed
   * "Settings".
   *
   * Licenses does not get this treatment on purpose. It is the same kind of
   * pushed screen but its content is a real `ScrollView`, so the large title
   * collapses and the bar blurs correctly, and taking it away would be a
   * regression.
   *
   * Android is unaffected either way -- it has no large titles and its header
   * is already opaque -- so this only needs to change anything on iOS.
   */
  const hostedScreenOptions = {
    headerLargeTitleEnabled: false,
    // Without a linked scroll view UIKit keeps the transparent scroll-edge
    // appearance, so the background has to be stated outright.
    headerTransparent: false,
    headerStyle: { backgroundColor: colors.background },
  } as const;

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
        options={{ title: t("settings.title"), ...hostedScreenOptions }}
      />
      <Stack.Screen
        name="language"
        options={{
          title: t("settings.languages.title"),
          ...hostedScreenOptions,
        }}
      />
      <Stack.Screen
        name="appearance"
        options={{ title: t("settings.app.theme"), ...hostedScreenOptions }}
      />
      <Stack.Screen
        name="getting-started"
        options={{
          title: t("settings.help.gettingStarted"),
          ...hostedScreenOptions,
        }}
      />
      <Stack.Screen
        name="about"
        options={{ title: t("settings.legal.about"), ...hostedScreenOptions }}
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
