import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
const calendars = vi.hoisted(() => vi.fn());
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));
vi.mock("expo-localization", () => ({
  useCalendars: calendars,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  calendars.mockReturnValue([{ uses24hourClock: true }]);
  storage.setItem.mockResolvedValue(undefined);
});

describe("time format preference", () => {
  it.each(["12", "24"] as const)(
    "loads stored %s-hour format over the device setting",
    async (value) => {
      storage.getItem.mockResolvedValue(value);
      const clock = await import("./device-clock");
      await clock.loadTimeFormatPreference();
      expect(
        clock.resolveHour12(
          clock.getTimeFormatPreference(),
          calendars()[0]?.uses24hourClock,
        ),
      ).toBe(value === "12");
    },
  );

  it("falls back to device format and leaves a missing device preference unspecified", async () => {
    storage.getItem.mockResolvedValue("invalid");
    const clock = await import("./device-clock");
    await clock.loadTimeFormatPreference();
    expect(clock.getTimeFormatPreference()).toBe("system");
    expect(
      clock.resolveHour12(
        clock.getTimeFormatPreference(),
        calendars()[0]?.uses24hourClock,
      ),
    ).toBe(false);
    calendars.mockReturnValue([{ uses24hourClock: null }]);
    expect(
      clock.resolveHour12(
        clock.getTimeFormatPreference(),
        calendars()[0]?.uses24hourClock,
      ),
    ).toBeUndefined();
  });

  it("notifies active screens after a successful save and preserves the choice on failed writes", async () => {
    const clock = await import("./device-clock");
    const listener = vi.fn();
    const unsubscribe = clock.subscribeTimeFormat(listener);
    await clock.saveTimeFormatPreference("12");
    expect(storage.setItem).toHaveBeenCalledWith("timeFormat", "12");
    expect(
      clock.resolveHour12(
        clock.getTimeFormatPreference(),
        calendars()[0]?.uses24hourClock,
      ),
    ).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    storage.setItem.mockRejectedValue(new Error("disk full"));
    await expect(clock.saveTimeFormatPreference("24")).rejects.toThrow(
      "disk full",
    );
    expect(
      clock.resolveHour12(
        clock.getTimeFormatPreference(),
        calendars()[0]?.uses24hourClock,
      ),
    ).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    storage.setItem.mockResolvedValue(undefined);
    await clock.saveTimeFormatPreference("24");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("timeFormatLabelKey", () => {
  it.each([
    ["system", "system"],
    ["12", "hour12"],
    ["24", "hour24"],
  ] as const)("names %s as the %s label", async (preference, key) => {
    const clock = await import("./device-clock");
    expect(clock.timeFormatLabelKey(preference)).toBe(key);
  });
});
