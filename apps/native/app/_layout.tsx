import "@formatjs/intl-getcanonicallocales/polyfill.js";
import "@formatjs/intl-locale/polyfill.js";
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
import "@formatjs/intl-pluralrules/locale-data/fr.js";
import "@formatjs/intl-pluralrules/locale-data/nl.js";
import "@formatjs/intl-pluralrules/locale-data/pl.js";
import "@formatjs/intl-pluralrules/locale-data/pt.js";
import "@formatjs/intl-pluralrules/locale-data/sv.js";
import "@formatjs/intl-numberformat/polyfill.js";
import "@formatjs/intl-numberformat/locale-data/de.js";
import "@formatjs/intl-numberformat/locale-data/en.js";
import "@formatjs/intl-numberformat/locale-data/es.js";
import "@formatjs/intl-numberformat/locale-data/fr.js";
import "@formatjs/intl-numberformat/locale-data/nl.js";
import "@formatjs/intl-numberformat/locale-data/pl.js";
import "@formatjs/intl-numberformat/locale-data/pt.js";
import "@formatjs/intl-numberformat/locale-data/sv.js";
import "@formatjs/intl-datetimeformat/polyfill.js";
import "@formatjs/intl-datetimeformat/locale-data/de.js";
import "@formatjs/intl-datetimeformat/locale-data/en.js";
import "@formatjs/intl-datetimeformat/locale-data/es.js";
import "@formatjs/intl-datetimeformat/locale-data/fr.js";
import "@formatjs/intl-datetimeformat/locale-data/nl.js";
import "@formatjs/intl-datetimeformat/locale-data/pl.js";
import "@formatjs/intl-datetimeformat/locale-data/pt.js";
import "@formatjs/intl-datetimeformat/locale-data/sv.js";
import "@formatjs/intl-datetimeformat/add-all-tz.js";
import "../src/global.css";

import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { AppState, StatusBar, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  applyAppearancePreference,
  loadAppearancePreference,
} from "@/lib/appearance-storage";
import { initI18n } from "@/lib/i18n";
import {
  reconcileEventReminders,
  setupNotificationHandler,
} from "@/services/notifications";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: !__DEV__ && Boolean(sentryDsn),
  sendDefaultPii: false,
});

setupNotificationHandler();
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const lightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#00729C",
  },
};

const darkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#18B7F2",
  },
};

function RootLayout() {
  const [ready, setReady] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    void (async () => {
      const appearance = await loadAppearancePreference().catch(
        () => "system" as const,
      );
      applyAppearancePreference(appearance);
      await initI18n().catch(() => undefined);
      await reconcileEventReminders().catch(() => undefined);
      await publishWidgetSnapshot().catch(() => false);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") void publishWidgetSnapshot().catch(() => false);
      },
    );
    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe((event) => {
        if (
          event.type === "updated" &&
          event.mutation.state.status === "success"
        ) {
          void publishWidgetSnapshot().catch(() => false);
        }
      });
    return () => {
      appStateSubscription.remove();
      unsubscribeMutations();
    };
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider
      value={
        colorScheme === "dark" ? darkNavigationTheme : lightNavigationTheme
      }
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar
            barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);
