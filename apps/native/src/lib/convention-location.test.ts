import { describe, expect, it, vi } from "vitest";
import {
  decideTimeZoneForLocationEdit,
  inferTimeZoneFromLocation,
  isValidCoordinates,
  normalizeLocationName,
  timeZoneFromCoordinates,
} from "./convention-location";

/** Stand-in for tz-lookup: real behaviour, no 150KB table in the test. */
const PITTSBURGH = { latitude: 40.4406, longitude: -79.9959 };
const lookup = vi.fn(() => "America/New_York");

describe("isValidCoordinates", () => {
  it("accepts in-range coordinates", () => {
    expect(isValidCoordinates(PITTSBURGH)).toBe(true);
    expect(isValidCoordinates({ latitude: -90, longitude: 180 })).toBe(true);
  });

  it("rejects out-of-range, non-finite, and malformed values", () => {
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidCoordinates({ latitude: Number.NaN, longitude: 0 })).toBe(
      false,
    );
    expect(isValidCoordinates({ latitude: "40", longitude: 0 })).toBe(false);
    expect(isValidCoordinates(null)).toBe(false);
    expect(isValidCoordinates(undefined)).toBe(false);
  });
});

describe("timeZoneFromCoordinates", () => {
  it("returns the looked-up zone for valid coordinates", () => {
    expect(timeZoneFromCoordinates(PITTSBURGH, lookup)).toBe(
      "America/New_York",
    );
  });

  it("returns null rather than calling the lookup on bad coordinates", () => {
    const spy = vi.fn(() => "America/New_York");
    expect(timeZoneFromCoordinates({ latitude: 999, longitude: 0 }, spy)).toBe(
      null,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("swallows a throwing lookup instead of propagating", () => {
    expect(
      timeZoneFromCoordinates(PITTSBURGH, () => {
        throw new Error("out of range");
      }),
    ).toBe(null);
  });

  it("rejects a zone this device cannot resolve", () => {
    expect(timeZoneFromCoordinates(PITTSBURGH, () => "Mars/Olympus_Mons")).toBe(
      null,
    );
  });

  it("rejects an empty or non-string lookup result", () => {
    expect(timeZoneFromCoordinates(PITTSBURGH, () => "")).toBe(null);
    expect(
      timeZoneFromCoordinates(PITTSBURGH, () => undefined as unknown as string),
    ).toBe(null);
  });
});

describe("inferTimeZoneFromLocation", () => {
  it("geocodes a normalized place before resolving its zone", async () => {
    const geocode = vi.fn(async () => [PITTSBURGH]);
    await expect(
      inferTimeZoneFromLocation(" Pittsburgh , PA ", geocode, lookup),
    ).resolves.toBe("America/New_York");
    expect(geocode).toHaveBeenCalledWith("Pittsburgh, PA");
  });

  it("returns null for blank locations and geocoder failures", async () => {
    const geocode = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(inferTimeZoneFromLocation("", geocode, lookup)).resolves.toBe(
      null,
    );
    expect(geocode).not.toHaveBeenCalled();
    await expect(
      inferTimeZoneFromLocation("Pittsburgh", geocode, lookup),
    ).resolves.toBe(null);
  });
});

describe("normalizeLocationName", () => {
  it("tidies spacing around commas without reformatting the name", () => {
    expect(normalizeLocationName("  Pittsburgh ,  PA ")).toBe("Pittsburgh, PA");
    expect(normalizeLocationName("San   Jose")).toBe("San Jose");
    expect(normalizeLocationName("")).toBe("");
  });
});

describe("decideTimeZoneForLocationEdit", () => {
  const base = {
    location: "Denver, CO",
    originalLocation: "Denver, CO",
    manuallySet: false,
  };

  // The bug this exists to prevent: clearing the location used to fall through
  // to the device zone, silently moving a Denver convention onto the phone's
  // clock and shifting every event time on the schedule.
  it("keeps the existing zone when the location is cleared", () => {
    expect(decideTimeZoneForLocationEdit({ ...base, location: "" })).toEqual({
      action: "keep",
    });
  });

  it("keeps the existing zone when the location did not change", () => {
    expect(decideTimeZoneForLocationEdit(base)).toEqual({ action: "keep" });
  });

  it("keeps a hand-picked zone even when the location changes", () => {
    expect(
      decideTimeZoneForLocationEdit({
        ...base,
        location: "Pittsburgh, PA",
        manuallySet: true,
      }),
    ).toEqual({ action: "keep" });
  });

  it("re-infers when the location changes to a real place", () => {
    expect(
      decideTimeZoneForLocationEdit({ ...base, location: "Pittsburgh, PA" }),
    ).toEqual({ action: "infer" });
  });

  it("infers when a convention that never had a location gains one", () => {
    expect(
      decideTimeZoneForLocationEdit({
        location: "Pittsburgh, PA",
        originalLocation: "",
        manuallySet: false,
      }),
    ).toEqual({ action: "infer" });
  });

  it("keeps the zone when an empty location stays empty", () => {
    expect(
      decideTimeZoneForLocationEdit({
        location: "",
        originalLocation: "",
        manuallySet: false,
      }),
    ).toEqual({ action: "keep" });
  });
});
