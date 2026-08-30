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

/**
 * The shared scaffold behind all three fallbacks below.
 *
 * Deliberately not `EmptyState`, which is otherwise the right component for
 * this shape: it renders through `@expo/ui`'s `Host` and `useTheme`, and every
 * screen here exists precisely because part of the app failed to start. A
 * fallback that can fail the same way as the thing it is covering is not a
 * fallback. This uses nothing but `View`, `Text` and `Button`.
 */
function FallbackScreen({
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  testID: string;
}) {
  return (
    <View
      className="flex-1 items-center justify-center gap-4 bg-background px-6"
      testID={testID}
    >
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      <Text variant="body" className="text-center text-muted-foreground">
        {message}
      </Text>
      <Button className="min-h-12 px-6" onPress={onAction}>
        {actionLabel}
      </Button>
    </View>
  );
}

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
    <FallbackScreen
      testID="screen-error-fallback"
      title={t("common.error")}
      message={t("errors.screen.message")}
      actionLabel={t("common.retry")}
      onAction={() => void retry()}
    />
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
    <FallbackScreen
      testID="database-unavailable-screen"
      title={t("errors.database.title")}
      message={t("errors.database.message")}
      actionLabel={t("common.retry")}
      onAction={() => void reloadAppAsync()}
    />
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
    <FallbackScreen
      testID="translations-unavailable-screen"
      title={TRANSLATIONS_UNAVAILABLE_TITLE}
      message={TRANSLATIONS_UNAVAILABLE_MESSAGE}
      actionLabel={TRANSLATIONS_UNAVAILABLE_RETRY}
      onAction={onRetry}
    />
  );
}
