import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { developerToolsEnabled } from "@/lib/developer-tools";

export default function SettingsLayout() {
  const { t } = useTranslation();
  const showDeveloperTools = developerToolsEnabled(
    __DEV__,
    Constants.expoConfig?.extra?.appVariant,
  );

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("settings.title"),
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
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
      <Stack.Protected guard={showDeveloperTools}>
        <Stack.Screen name="debug" options={{ title: "Debug Tools" }} />
        <Stack.Screen name="ui-system" options={{ title: "UI System" }} />
      </Stack.Protected>
    </Stack>
  );
}
