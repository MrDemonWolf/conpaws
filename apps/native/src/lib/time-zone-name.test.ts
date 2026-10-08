import { describe, expect, it, vi } from "vitest";
import { localizedTimeZoneName } from "./time-zone-name";

describe("localizedTimeZoneName", () => {
  it("returns a localized generic name", () => {
    expect(localizedTimeZoneName("America/New_York", "en-US")).toBe(
      "Eastern Time",
    );
  });

  it("uses the city when the runtime only offers an offset", () => {
    const format = Intl.DateTimeFormat;
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      (locale, options) =>
        ({
          formatToParts: () => [{ type: "timeZoneName", value: "GMT-5" }],
          resolvedOptions: () => new format(locale, options).resolvedOptions(),
        }) as unknown as Intl.DateTimeFormat,
    );
    try {
      expect(localizedTimeZoneName("America/New_York", "en-US")).toBe(
        "New York",
      );
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("falls back to the identifier for an invalid zone", () => {
    expect(localizedTimeZoneName("Mars/Olympus_Mons", "en-US")).toBe(
      "Mars/Olympus_Mons",
    );
  });
});
