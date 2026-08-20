import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { developerToolsEnabled } from "@/lib/developer-tools";

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
        name="technology"
        options={{ title: t("settings.technology.title") }}
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
