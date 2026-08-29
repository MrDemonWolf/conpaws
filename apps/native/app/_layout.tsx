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
// Starts Sentry from a bare import so it is running before the imports below
// evaluate. `@/services/notifications` reaches `@/db`, which opens and migrates
// SQLite during module evaluation, and that is the failure most worth seeing.
import "@/lib/error-reporting-boot";

import * as Sentry from "@sentry/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as ExpoNotifications from "expo-notifications";
import {
  DarkTheme,
  DefaultTheme,
  router,
  Stack,
  ThemeProvider,
  usePathname,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { AppState, StatusBar, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { getDatabaseInitError } from "@/db";
import {
  applyAppearancePreference,
  loadAppearancePreference,
} from "@/lib/appearance-storage";
import {
  DatabaseUnavailableScreen,
  ScreenErrorFallback,
  TranslationsUnavailableScreen,
} from "@/lib/error-fallback";
import {
  addReportBreadcrumb,
  reportError,
  reportMessage,
} from "@/lib/error-reporting";
import { loadHapticsPreference } from "@/lib/haptics-storage";
import i18nInstance, { initI18n } from "@/lib/i18n";
import {
  getCachedOnboardingFlag,
  hasCompletedOnboarding,
} from "@/lib/onboarding-storage";
import { resolveQuickActionRoute } from "@/lib/quick-action-routes";
import { getDefaultReminderMinutes } from "@/lib/reminder-default-storage";
import { recordReminderReconciliation } from "@/lib/reminder-notice";
import {
  reconcileEventReminders,
  setupNotificationHandler,
} from "@/services/notifications";
import { consumePendingQuickAction } from "@/services/quick-actions";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

setupNotificationHandler();

// Notification taps already routed this launch, keyed by request identifier.
const handledNotificationResponses = new Set<string>();
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// A hung native call used to leave the app on the splash forever, because
// nothing hides it until `ready` is set. Past this point the app renders with
// whatever the bootstrap managed to load.
const BOOTSTRAP_TIMEOUT_MS = 10_000;

const lightNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#005575",
  },
};

const darkNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#18B7F2",
  },
};

async function withBootstrapTimeout<T>(
  work: Promise<T>,
  timedOutValue: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          reportMessage(
            `Launch bootstrap did not settle within ${BOOTSTRAP_TIMEOUT_MS}ms`,
            { scope: "bootstrap.timeout" },
          );
          resolve(timedOutValue);
        }, BOOTSTRAP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    // Losing the race is the normal case, and an uncleared timer would report
    // a timeout on every launch that succeeded.
    clearTimeout(timer);
  }
}

/**
 * Loads everything the first paint depends on.
 *
 * Every step reports its own failure and then continues: a lost haptics
 * preference must not stop the app from launching. Translations are the one
 * exception -- see the retry, and the caller's `isInitialized` check.
 *
 * Resolves to whether onboarding has been completed, which the caller needs
 * before it may act on a parked quick action.
 */
async function runLaunchBootstrap(): Promise<boolean> {
  const appearance = await loadAppearancePreference().catch((error) => {
    reportError(error, { scope: "bootstrap.appearanceLoad" });
    return "system" as const;
  });

  try {
    applyAppearancePreference(appearance);
  } catch (error) {
    reportError(error, { scope: "bootstrap.appearanceApply" });
  }

  await loadHapticsPreference().catch((error) => {
    reportError(error, { scope: "bootstrap.haptics" });
    return true;
  });

  // Primes the cache the reminder picker reads synchronously.
  await getDefaultReminderMinutes().catch(() => null);

  try {
    await initI18n();
  } catch (error) {
    reportError(error, { scope: "bootstrap.i18n" });
    // The only await here that realistically rejects is the stored-language
    // read, so a second attempt is worth making before giving up on every
    // label in the app.
    try {
      await initI18n();
    } catch (retryError) {
      reportError(retryError, { scope: "bootstrap.i18nRetry" });
    }
  }

  return hasCompletedOnboarding().catch((error) => {
    reportError(error, { scope: "bootstrap.onboardingFlag" });
    // Assuming onboarding is unfinished only parks a quick action for the next
    // launch, where this read gets another chance. Assuming it is finished
    // would push a form at someone who has never seen the app.
    return false;
  });
}

function RootLayout() {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [translationsReady, setTranslationsReady] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const databaseInitError = getDatabaseInitError();

  // `ready` deliberately stays true across a retry: the splash is long gone,
  // so dropping back to it would blank the screen instead of leaving the
  // message the user just acted on.
  const retryBootstrap = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (attempt > 0) {
        addReportBreadcrumb(`Launch bootstrap retry ${attempt}`, {
          scope: "bootstrap.retry",
        });
      }
      const onboarded = await withBootstrapTimeout(runLaunchBootstrap(), false);
      if (cancelled) return;
      setTranslationsReady(i18nInstance.isInitialized);
      setOnboardingComplete(onboarded);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Neither of these affects what is painted, so they run after the first
  // frame instead of holding the splash open.
  useEffect(() => {
    if (!ready || databaseInitError) return;

    void reconcileEventReminders()
      .then(recordReminderReconciliation)
      .catch((error) => {
        reportError(error, { scope: "bootstrap.reconcileReminders" });
      });
    void publishWidgetSnapshot().catch((error) => {
      reportError(error, { scope: "bootstrap.publishWidgetSnapshot" });
    });
  }, [ready, databaseInitError]);

  useEffect(() => {
    addReportBreadcrumb(pathname, { scope: "navigation" });
  }, [pathname]);

  // Neither a quick action nor a tapped reminder has anywhere to land while
  // the database-unavailable screen is up: that branch renders no navigator.
  const navigable = ready && !databaseInitError;

  // The Home Screen shortcuts are installed at launch with no onboarding gate
  // of their own, so acting on one before `app/index.tsx` has resolved the flag
  // drops a brand new user straight into a form they have no context for.
  // Leaving the action unconsumed parks it for the launch after onboarding.
  // The cache half covers finishing onboarding in THIS session:
  // markOnboardingComplete primes it synchronously, while the
  // `onboardingComplete` state is only re-read on the next bootstrap — a
  // quick action tapped right after onboarding used to stay parked until the
  // next cold launch.
  const canOpenQuickAction =
    navigable && (onboardingComplete || getCachedOnboardingFlag() === true);

  useEffect(() => {
    function openPendingQuickAction() {
      const pending = consumePendingQuickAction();
      if (!pending) return;

      const route = resolveQuickActionRoute(pending);
      if (!route) {
        // A shortcut pointing at a screen this build does not have means a
        // route was renamed without updating the table. Doing nothing quietly
        // is what made that drift invisible, so say so instead.
        reportMessage(`Unknown quick action route: ${pending}`, {
          scope: "quickAction.unknownRoute",
        });
        return;
      }
      // Deliberately not behind a presentation lock: quick actions and
      // notification taps are OS-triggered one-shots (the pending route is
      // consumed on read, and notification responses dedupe by identifier),
      // so the double-tap race the screen-level locks guard against cannot
      // happen here.
      router.push(route);
    }

    if (canOpenQuickAction) openPendingQuickAction();
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active" && navigable) {
          if (canOpenQuickAction) openPendingQuickAction();
          void publishWidgetSnapshot().catch((error) => {
            reportError(error, { scope: "appState.publishWidgetSnapshot" });
          });
          // Reminders the OS refused for want of permission stay saved but
          // unscheduled. Reconciling on every foreground re-arms them the moment
          // the user comes back from granting it, rather than at the next cold
          // launch. Safe to run this often only because reconciling no longer
          // treats a missing permission as an instruction to forget the reminder.
          void reconcileEventReminders()
            .then(recordReminderReconciliation)
            .catch((error) => {
              reportError(error, { scope: "appState.reconcileReminders" });
            });
        }
      },
    );
    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe((event) => {
        if (
          event.type === "updated" &&
          event.mutation.state.status === "success"
        ) {
          void publishWidgetSnapshot().catch((error) => {
            reportError(error, { scope: "mutation.publishWidgetSnapshot" });
          });
        }
      });
    return () => {
      appStateSubscription.remove();
      unsubscribeMutations();
    };
  }, [navigable, canOpenQuickAction]);

  // A tapped reminder must land on the event's convention rather than wherever
  // the app happened to be. The cold-start response arrives through
  // getLastNotificationResponseAsync, the warm one through the listener, and
  // the identifier set stops a cold start from navigating twice.
  useEffect(() => {
    if (!navigable) return;
    // Module-level, not effect-local: the effect re-runs when `navigable`
    // flips (bootstrap retry), and a fresh set would let
    // getLastNotificationResponseAsync re-push the same tap.
    const handled = handledNotificationResponses;

    function openReminderTarget(
      response: ExpoNotifications.NotificationResponse | null,
    ) {
      if (!response) return;
      const { content, identifier } = response.notification.request;
      const data = content.data as Record<string, unknown> | undefined;
      if (data?.kind !== "event-reminder") return;

      const conventionId =
        typeof data.conventionId === "string" ? data.conventionId : null;
      if (!conventionId || handled.has(identifier)) return;

      handled.add(identifier);
      const eventId = typeof data.eventId === "string" ? data.eventId : null;
      router.push({
        pathname: "/convention/[id]",
        // highlightEventId scrolls the schedule to the event that fired —
        // landing on the convention with no focus made the tap feel broken.
        params: eventId
          ? { id: conventionId, highlightEventId: eventId }
          : { id: conventionId },
      });
    }

    ExpoNotifications.getLastNotificationResponseAsync()
      .then(openReminderTarget)
      .catch((error) => {
        reportError(error, { scope: "notifications.lastResponse" });
      });

    const subscription =
      ExpoNotifications.addNotificationResponseReceivedListener(
        openReminderTarget,
      );
    return () => subscription.remove();
  }, [navigable]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const navigationTheme =
    colorScheme === "dark" ? darkNavigationTheme : lightNavigationTheme;

  if (databaseInitError) {
    return (
      <ThemeProvider value={navigationTheme}>
        <SafeAreaProvider>
          <StatusBar
            barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
          />
          <DatabaseUnavailableScreen error={databaseInitError} />
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  // Without an initialised i18next every label in the app renders as its own
  // translation key, which looks like a broken app and says nothing. A plain
  // English retry screen is the honest version of that state.
  if (!translationsReady) {
    return <TranslationsUnavailableScreen onRetry={retryBootstrap} />;
  }

  return (
    // GestureHandlerRootView hosts the swipeable event rows; the error
    // branches above have no gestures and deliberately skip it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar
              barStyle={
                colorScheme === "dark" ? "light-content" : "dark-content"
              }
            />
            <Stack screenOptions={{ headerShown: false }} />
          </QueryClientProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap does NOT install an error boundary in @sentry/react-native
// 7.11.0 (verified in dist/js/sdk.js: it renders TouchEventBoundary, Profiler
// and FeedbackWidgetProvider only), so these two exports are the app's only
// boundaries. `screenErrorBoundary` is inherited through context by every
// descendant leaf route, which keeps headers and the tab bar mounted; the
// `ErrorBoundary` export is the last resort for a throw in this layout itself.
export const unstable_settings = {
  screenErrorBoundary: ScreenErrorFallback,
};

export const ErrorBoundary = ScreenErrorFallback;

export default Sentry.wrap(RootLayout);
