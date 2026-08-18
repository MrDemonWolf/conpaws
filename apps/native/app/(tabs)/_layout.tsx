import { Tabs } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colorScheme === "dark" ? "#94A3B8" : "#64748B",
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("common.home"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("common.settings"),
        }}
      />
    </Tabs>
  );
}
