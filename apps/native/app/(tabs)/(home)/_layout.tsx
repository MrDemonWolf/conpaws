import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";

export const unstable_settings = {
  anchor: "index",
};

export default function HomeLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
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
          title: t("home.title"),
        }}
      />
      <Stack.Screen name="convention/[id]" options={{ title: "Convention" }} />
      <Stack.Screen
        name="convention/create"
        options={{
          title: t("convention.new"),
          headerLargeTitleEnabled: false,
          headerShown: process.env.EXPO_OS === "ios",
          presentation: "formSheet",
          sheetAllowedDetents: [0.55, 0.85],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="convention/[id]/edit"
        options={{
          title: t("convention.edit"),
          headerLargeTitleEnabled: false,
          headerShown: process.env.EXPO_OS === "ios",
          presentation: "formSheet",
          sheetAllowedDetents: [0.55, 0.85],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="convention/[id]/import"
        options={{
          title: t("import.title"),
          headerLargeTitleEnabled: false,
          headerShown: process.env.EXPO_OS === "ios",
          headerShadowVisible: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 0.9, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
