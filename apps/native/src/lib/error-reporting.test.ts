import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@sentry/react-native", () => sentry);

import {
  addReportBreadcrumb,
  initErrorReporting,
  isErrorReportingEnabled,
  reportError,
  reportMessage,
} from "./error-reporting";

const globals = globalThis as { __DEV__?: boolean };
const VALID_DSN = "https://public@example.invalid/1";

function setDevelopmentBuild(isDev: boolean): void {
  globals.__DEV__ = isDev;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  setDevelopmentBuild(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  globals.__DEV__ = undefined;
});

describe("error reporting startup", () => {
  it("leaves the native SDK alone when there is no usable DSN", () => {
    expect(initErrorReporting(false, undefined)).toBe(false);
    expect(initErrorReporting(false, "not-a-dsn")).toBe(false);
    expect(initErrorReporting(true, VALID_DSN)).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
    expect(isErrorReportingEnabled()).toBe(false);
  });

  it("starts the native SDK for a configured release build", () => {
    expect(initErrorReporting(false, VALID_DSN)).toBe(true);
    expect(sentry.init).toHaveBeenCalledWith({
      dsn: VALID_DSN,
      sendDefaultPii: false,
    });
    expect(isErrorReportingEnabled()).toBe(true);
  });
});

describe("reportError", () => {
  it("sends the error with its scope as a tag", () => {
    const failure = new Error("migration failed");

    reportError(failure, {
      scope: "db.open",
      tags: { store: "conventions" },
      extra: { attempt: 2 },
    });

    expect(sentry.captureException).toHaveBeenCalledWith(failure, {
      tags: { scope: "db.open", store: "conventions" },
      extra: { attempt: 2 },
    });
  });

  it("wraps a thrown non-Error so the event still has a stack", () => {
    reportError("disk is full", { scope: "db.open" });

    const [reported] = sentry.captureException.mock.calls[0];
    expect(reported).toBeInstanceOf(Error);
    expect((reported as Error).message).toBe("disk is full");
  });

  it("logs to the console instead of Sentry in a development build", () => {
    setDevelopmentBuild(true);

    reportError(new Error("boom"), { scope: "import.apply" });

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("never throws out of a catch block", () => {
    sentry.captureException.mockImplementationOnce(() => {
      throw new Error("transport is down");
    });

    expect(() =>
      reportError(new Error("boom"), { scope: "import.apply" }),
    ).not.toThrow();
  });
});

describe("reportMessage and breadcrumbs", () => {
  it("defaults a message to warning level", () => {
    reportMessage("schema is newer than this build", { scope: "db.downgrade" });

    expect(sentry.captureMessage).toHaveBeenCalledWith(
      "schema is newer than this build",
      { level: "warning", tags: { scope: "db.downgrade" }, extra: undefined },
    );
  });

  it("records a breadcrumb under its scope", () => {
    addReportBreadcrumb("/convention/abc", { scope: "navigation" });

    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "navigation",
      message: "/convention/abc",
      level: "info",
      data: undefined,
    });
  });

  it("drops breadcrumbs in a development build, where nothing is sent", () => {
    setDevelopmentBuild(true);

    addReportBreadcrumb("/settings", { scope: "navigation" });

    expect(sentry.addBreadcrumb).not.toHaveBeenCalled();
  });
});
