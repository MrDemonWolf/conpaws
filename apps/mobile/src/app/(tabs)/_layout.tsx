import { Tabs } from "expo-router";
import { PawPrint, User, Settings } from "@/lib/icons";
import { useColorScheme } from "@/lib/useColorScheme";

export default function TabLayout() {
  const { isDark } = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? "#8b5cf6" : "#6D28D9",
        tabBarInactiveTintColor: isDark ? "#a8a29e" : "#78716c",
        tabBarStyle: {
          backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
          borderTopColor: isDark ? "#44403c" : "#e7e5e4",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <PawPrint size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
