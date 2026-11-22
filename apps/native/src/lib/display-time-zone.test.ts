import { beforeEach, describe, expect, it, vi } from "vitest";

const calendars = vi.hoisted(() => vi.fn());
vi.mock("expo-localization", () => ({ getCalendars: calendars }));

import { displayTimeZone, getDeviceTimeZone } from "./display-time-zone";

beforeEach(() => {
  calendars.mockReturnValue([{ timeZone: "Europe/Berlin" }]);
});

describe("getDeviceTimeZone", () => {
  it("reads the first calendar's zone", () => {
    expect(getDeviceTimeZone()).toBe("Europe/Berlin");
  });

  it("falls back to UTC when the OS reports no zone", () => {
    calendars.mockReturnValue([]);
    expect(getDeviceTimeZone()).toBe("UTC");
    calendars.mockReturnValue([{ timeZone: null }]);
    expect(getDeviceTimeZone()).toBe("UTC");
  });
});

describe("displayTimeZone", () => {
  it("keeps a convention's own zone when the device knows it", () => {
    expect(displayTimeZone("America/Chicago")).toBe("America/Chicago");
  });

  it("uses the device zone for a missing or unknown one", () => {
    expect(displayTimeZone(null)).toBe("Europe/Berlin");
    expect(displayTimeZone(undefined)).toBe("Europe/Berlin");
    expect(displayTimeZone("")).toBe("Europe/Berlin");
    expect(displayTimeZone("Mars/Olympus_Mons")).toBe("Europe/Berlin");
  });
});
