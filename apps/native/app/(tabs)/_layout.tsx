import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0FACED",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          borderTopColor: "#E2E8F0",
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
        name="profile"
        options={{
          title: t("common.profile"),
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
