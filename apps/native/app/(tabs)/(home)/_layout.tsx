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
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: t("home.title"),
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }}
      />
      <Stack.Screen name="convention/[id]" options={{ title: "Convention" }} />
      <Stack.Screen
        name="convention/[id]/import"
        options={{
          headerShown: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.9, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
