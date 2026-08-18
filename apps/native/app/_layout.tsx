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
import { useEffect, useState } from "react";
import { StatusBar, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { initI18n } from "@/lib/i18n";
import {
  reconcileEventReminders,
  setupNotificationHandler,
} from "@/services/notifications";

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: sentryDsn,
  enabled: !__DEV__ && Boolean(sentryDsn),
  sendDefaultPii: false,
});

setupNotificationHandler();

const queryClient = new QueryClient();

const lightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#006F91",
    background: "#FFFFFF",
    card: "#F8FAFC",
    text: "#0F172A",
    border: "#E2E8F0",
  },
};

const darkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#18B7F2",
    background: "#091533",
    card: "#0F1D45",
    text: "#F8FAFC",
    border: "#1E3A5F",
  },
};

function RootLayout() {
  const [ready, setReady] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    void Promise.allSettled([initI18n(), reconcileEventReminders()]).then(() =>
      setReady(true),
    );
  }, []);

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
