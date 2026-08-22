import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";

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
