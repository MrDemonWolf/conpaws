import * as Sentry from "@sentry/react-native";
import { getSentryOptions } from "./sentry-config";

/**
 * Structured detail attached to every reported event.
 *
 * `scope` is a stable dotted identifier for the failing operation, not a
 * message. It becomes a Sentry tag, so it must stay low cardinality: never
 * interpolate an id, a file name or user text into it.
 */
export interface ErrorReportContext {
  scope: string;
  /** Low-cardinality tags. Values are coerced to strings by Sentry. */
  tags?: Record<string, string>;
  /** Arbitrary structured detail. Must not contain user content or PII. */
  extra?: Record<string, unknown>;
}

export type ReportLevel = "info" | "warning" | "error";

let reportingEnabled = false;

// The RN globals are absent under the Vitest node environment, where `typeof`
// on an undeclared identifier is the only safe way to ask.
function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

/**
 * Starts the native SDK. Called from `error-reporting-boot`, which the root
 * layout imports before anything that can throw during module evaluation.
 *
 * Returns whether reporting is actually on, which is false for every debug
 * build and for a release built without a usable DSN.
 */
export function initErrorReporting(
  isDev: boolean,
  dsn: string | undefined,
): boolean {
  const options = getSentryOptions(isDev, dsn);
  if (!options) {
    reportingEnabled = false;
    return false;
  }

  Sentry.init(options);
  reportingEnabled = true;
  return true;
}

/** Whether events are actually being delivered, for the debug screen to show. */
export function isErrorReportingEnabled(): boolean {
  return reportingEnabled;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : JSON.stringify(error));
}

/**
 * Reports a caught error.
 *
 * Call this at the boundary that already owns the failure, next to whatever
 * the user sees. It never throws and never rethrows, so it is safe inside a
 * catch that must not change control flow.
 */
export function reportError(error: unknown, context: ErrorReportContext): void {
  const reported = toError(error);

  if (isDevelopmentBuild()) {
    // The stack, not the error object: React Native's console prints a caught
    // Error as bare `[TypeError: undefined is not a function]` with no frames,
    // which names the symptom and hides the file. Printing `.stack` is what
    // turns a screen-boundary report into something you can act on.
    console.error(
      `[${context.scope}]`,
      reported.stack ?? reported,
      context.extra ?? {},
    );
    return;
  }

  try {
    Sentry.captureException(reported, {
      tags: { scope: context.scope, ...context.tags },
      extra: context.extra,
    });
  } catch {
    // Reporting a failure must never become a second failure.
  }
}

/** Reports a condition that is not an exception, such as a refused downgrade. */
export function reportMessage(
  message: string,
  context: ErrorReportContext & { level?: ReportLevel },
): void {
  if (isDevelopmentBuild()) {
    console.warn(`[${context.scope}]`, message, context.extra ?? {});
    return;
  }

  try {
    Sentry.captureMessage(message, {
      level: context.level ?? "warning",
      tags: { scope: context.scope, ...context.tags },
      extra: context.extra,
    });
  } catch {}
}

/**
 * Records a breadcrumb so the events that do arrive carry a trail.
 *
 * Breadcrumbs are cheap and are only sent attached to a later event, so this
 * stays a no-op in development where no event is ever sent.
 */
export function addReportBreadcrumb(
  message: string,
  context: ErrorReportContext & { level?: ReportLevel },
): void {
  if (isDevelopmentBuild()) return;

  try {
    Sentry.addBreadcrumb({
      category: context.scope,
      message,
      level: context.level ?? "info",
      data: context.extra,
    });
  } catch {}
}
