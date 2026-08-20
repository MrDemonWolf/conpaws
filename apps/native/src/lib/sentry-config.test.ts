import { describe, expect, it } from "vitest";
import { getSentryOptions } from "./sentry-config";

describe("Sentry startup configuration", () => {
  it("does not start the native SDK without a release DSN", () => {
    expect(getSentryOptions(false, undefined)).toBeNull();
    expect(getSentryOptions(false, "   ")).toBeNull();
    expect(getSentryOptions(false, "placeholder")).toBeNull();
    expect(getSentryOptions(false, "https://example.invalid/1")).toBeNull();
    expect(
      getSentryOptions(false, "https://public@example.invalid/project"),
    ).toBeNull();
    expect(
      getSentryOptions(true, "https://public@example.invalid/1"),
    ).toBeNull();
  });

  it("starts the native SDK for a configured release", () => {
    expect(
      getSentryOptions(false, " https://public@example.invalid/1 "),
    ).toEqual({
      dsn: "https://public@example.invalid/1",
      sendDefaultPii: false,
    });
  });
});
