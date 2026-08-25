import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";

export const unstable_settings = {
  anchor: "index",
};

// iOS gets a detented sheet; Android gets a full-screen modal. A sheet on
// Android re-lays-out when the keyboard opens, which clipped the form's header
// row down to unreadable slivers of Cancel and Save. Full-screen is also the
// Material 3 full-screen-dialog pattern.
const FORM_PRESENTATION = process.env.EXPO_OS === "ios" ? "formSheet" : "modal";

// `Stack.Toolbar` only reaches the header on iOS, so Android renders its own
// `FormModalHeader` in-content and must not also show the native header.
const FORM_HEADER_SHOWN = process.env.EXPO_OS === "ios";

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
          headerShown: FORM_HEADER_SHOWN,
          presentation: FORM_PRESENTATION,
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
          headerShown: FORM_HEADER_SHOWN,
          presentation: FORM_PRESENTATION,
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
          headerShadowVisible: false,
          headerShown: FORM_HEADER_SHOWN,
          presentation: FORM_PRESENTATION,
          sheetAllowedDetents: [0.5, 0.9, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}
