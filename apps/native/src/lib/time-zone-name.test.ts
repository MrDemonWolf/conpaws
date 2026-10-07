import { describe, expect, it } from "vitest";
import { localizedTimeZoneName } from "./time-zone-name";

describe("localizedTimeZoneName", () => {
  it("returns a localized generic name", () => {
    expect(localizedTimeZoneName("America/New_York", "en-US")).toBe(
      "Eastern Time",
    );
  });

  it("falls back to the identifier for an invalid zone", () => {
    expect(localizedTimeZoneName("Mars/Olympus_Mons", "en-US")).toBe(
      "Mars/Olympus_Mons",
    );
  });
});
