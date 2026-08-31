import { Stack } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import { useTranslation } from "react-i18next";
import { ScreenErrorFallback } from "@/lib/error-fallback";

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
          // Opens tall. At 0.55 a form with several fields showed roughly its
          // first two, so the sheet arrived already needing to be dragged --
          // and the reader has to discover that before they can even read what
          // they are filling in. The short detent stays available for peeking
          // at the list behind.
          sheetInitialDetentIndex: 1,
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
          // Opens tall. At 0.55 a form with several fields showed roughly its
          // first two, so the sheet arrived already needing to be dragged --
          // and the reader has to discover that before they can even read what
          // they are filling in. The short detent stays available for peeking
          // at the list behind.
          sheetInitialDetentIndex: 1,
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="convention/[id]/event/[eventId]"
        options={{
          headerShown: false,
          // Both platforms get a real sheet here — unlike the forms above,
          // this screen has no keyboard, so the Android formSheet re-layout
          // problem that pushed the forms to full-screen modals cannot occur.
          // fitToContents requires the content to have NATURAL height — a
          // flex-1 wrapper makes the measurement come back screen-sized and
          // the sheet opens tall with the content pinned to its bottom edge.
          // EventSheetContent is deliberately unflexed for this reason.
          presentation: "formSheet",
          sheetAllowedDetents: "fitToContents",
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
          // This screen is the worst offender at a short default: two source
          // sections, help, and then whatever the fetch produced. At 0.5 the
          // error, the preview and the import button all landed below the fold
          // -- a failed fetch scrolled its own explanation out of sight, which
          // read as the button doing nothing.
          sheetInitialDetentIndex: 1,
          sheetGrabberVisible: true,
        }}
      />
    </Stack>
  );
}

// A throw in this layout itself cannot reach the per-screen boundary the root
// layout provides, so it needs its own. Leaf screens under it are already
// covered and keep their chrome.
export const ErrorBoundary = ScreenErrorFallback;
