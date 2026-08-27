import { reloadAppAsync } from "expo";
import type { ErrorBoundaryProps } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { reportError, reportMessage } from "@/lib/error-reporting";

// Deliberately not translated: this screen only ever renders when i18next
// failed to initialise, so t() would return the raw key for every string.
const TRANSLATIONS_UNAVAILABLE_TITLE = "ConPaws couldn't finish starting";
const TRANSLATIONS_UNAVAILABLE_MESSAGE =
  "Its text couldn't be loaded on this device. Nothing you saved is affected.";
const TRANSLATIONS_UNAVAILABLE_RETRY = "Try Again";

/** Reports once per distinct error, not once per render of the fallback. */
function useReportedOnce(error: Error, scope: string): void {
  const reportedRef = useRef<Error | null>(null);

  useEffect(() => {
    if (reportedRef.current === error) return;
    reportedRef.current = error;
    reportError(error, { scope });
  }, [error, scope]);
}

/**
 * The fallback every route falls back to.
 *
 * A boundary marks the error handled, so Sentry never sees it unless the
 * fallback reports it itself. That report is the whole point of this component
 * existing rather than expo-router's own default screen.
 */
export function ScreenErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  useReportedOnce(error, "render.screen");

  return (
    <View
      className="flex-1 items-center justify-center gap-4 bg-background px-6"
      testID="screen-error-fallback"
    >
      <Text variant="h3" className="text-center">
        {t("common.error")}
      </Text>
      <Text variant="body" className="text-center text-muted-foreground">
        {t("errors.screen.message")}
      </Text>
      <Button className="min-h-12 px-6" onPress={() => void retry()}>
        {t("common.retry")}
      </Button>
    </View>
  );
}

/**
 * Shown instead of the app when SQLite could not be opened or migrated.
 *
 * Restarting is the only recovery this screen can offer: the store is opened
 * once during module evaluation, so a retry has to re-run the whole bundle.
 */
export function DatabaseUnavailableScreen({ error }: { error: Error }) {
  const { t } = useTranslation();
  useReportedOnce(error, "db.unavailableScreen");

  return (
    <View
      className="flex-1 items-center justify-center gap-4 bg-background px-6"
      testID="database-unavailable-screen"
    >
      <Text variant="h3" className="text-center">
        {t("errors.database.title")}
      </Text>
      <Text variant="body" className="text-center text-muted-foreground">
        {t("errors.database.message")}
      </Text>
      <Button className="min-h-12 px-6" onPress={() => void reloadAppAsync()}>
        {t("common.retry")}
      </Button>
    </View>
  );
}

/**
 * Shown when i18next never initialised.
 *
 * The alternative is an app whose every label reads as a raw translation key,
 * which looks broken, explains nothing and offers no way back.
 */
export function TranslationsUnavailableScreen({
  onRetry,
}: {
  onRetry: () => void;
}) {
  useEffect(() => {
    reportMessage("Rendered the translations-unavailable screen", {
      scope: "bootstrap.i18nUnavailable",
      level: "error",
    });
  }, []);

  return (
    <View
      className="flex-1 items-center justify-center gap-4 bg-background px-6"
      testID="translations-unavailable-screen"
    >
      <Text variant="h3" className="text-center">
        {TRANSLATIONS_UNAVAILABLE_TITLE}
      </Text>
      <Text variant="body" className="text-center text-muted-foreground">
        {TRANSLATIONS_UNAVAILABLE_MESSAGE}
      </Text>
      <Button className="min-h-12 px-6" onPress={onRetry}>
        {TRANSLATIONS_UNAVAILABLE_RETRY}
      </Button>
    </View>
  );
}
