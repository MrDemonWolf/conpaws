import { beforeEach, describe, expect, it, vi } from "vitest";

const publishSnapshot = vi.fn((_json: string) => true);
const getWidgetStrings = vi.fn(
  (_locale: string): Record<string, unknown> | null => null,
);
const publishPhoneWidget = vi.fn();
const getAll = vi.fn();

vi.mock("expo", () => ({
  requireOptionalNativeModule: () => ({ publishSnapshot, getWidgetStrings }),
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));
vi.mock("expo-localization", () => ({
  getCalendars: () => [{ uses24hourClock: true }],
}));
vi.mock("@/lib/appearance-storage", () => ({
  getAppearancePreference: () => "system",
}));
vi.mock("./widget-publication", () => ({ publishPhoneWidget }));
const reconcileTrackedEvent = vi.fn(async () => {});
vi.mock("./tracked-event", () => ({ reconcileTrackedEvent }));
const reportError = vi.fn();
vi.mock("@/lib/error-reporting", () => ({ reportError }));
vi.mock("@/db/repositories/conventions", () => ({ getAll }));
const getByConventionId = vi.fn(async (_id: string): Promise<unknown[]> => []);
vi.mock("@/db/repositories/events", () => ({ getByConventionId }));
vi.mock("@/lib/i18n", () => ({
  default: { t: () => "", resolvedLanguage: "en", language: "en" },
}));

const { publishWidgetSnapshot } = await import("./widget-snapshot");

describe("publishWidgetSnapshot", () => {
  beforeEach(() => {
    publishSnapshot.mockClear();
    publishPhoneWidget.mockClear();
    getAll.mockReset();
  });

  it("keeps phone presentation out of the Watch and timer snapshot", async () => {
    getAll.mockResolvedValueOnce([]);
    await publishWidgetSnapshot();
    const nativeJSON = publishSnapshot.mock.calls[0]?.[0];
    expect(nativeJSON).toBeDefined();
    expect(JSON.parse(nativeJSON ?? "{}")).not.toHaveProperty("presentation");
    expect(publishPhoneWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        presentation: expect.objectContaining({ hour12: false }),
      }),
    );
  });

  it("hands the phone widget only the strings it reads, not the whole Watch table", async () => {
    // Every iOS timeline entry carries this table, so the Watch's share of it
    // used up the entry budget and expired the widget early.
    const minutesUnit = {
      one: "%@ minute",
      few: "%@ minutes",
      other: "%@ minutes",
      obliqueOne: "%@ minute",
      obliqueFew: "%@ minutes",
      obliqueOther: "%@ minutes",
    };
    getWidgetStrings.mockReturnValueOnce({
      language: "en",
      upNextCaps: "UP NEXT",
      hourBefore: "1 hour before",
      atEventTime: "At event time",
      minutesUnit,
      savedCaps: "SAVED",
      watchRemoveFormat: "Remove %@ from your plan",
    });
    getAll.mockResolvedValueOnce([]);
    await publishWidgetSnapshot();
    expect(getWidgetStrings).toHaveBeenCalledWith("en");
    expect(publishPhoneWidget.mock.calls[0]?.[0].presentation.strings).toEqual({
      language: "en",
      upNextCaps: "UP NEXT",
      hourBefore: "1 hour before",
      atEventTime: "At event time",
      minutesUnit,
    });
  });

  it("gives only the iOS Watch payload descriptions and options", async () => {
    const now = Date.now();
    const day = (offset: number) =>
      new Date(now + offset * 86_400_000).toISOString().slice(0, 10);
    const row = (id: string, isInSchedule: boolean) => ({
      id,
      conventionId: "con",
      title: id,
      description: `<p>About ${id}</p>`,
      startTime: new Date(now + 600_000).toISOString(),
      endTime: new Date(now + 4_200_000).toISOString(),
      location: null,
      room: null,
      isInSchedule,
      reminderMinutes: null,
      ageRating: null,
      feedStatus: null,
    });
    getAll.mockResolvedValue([
      {
        id: "con",
        name: "Con",
        startDate: day(-1),
        endDate: day(1),
        timeZone: "UTC",
      },
    ]);
    getByConventionId.mockResolvedValue([
      row("saved", true),
      row("option", false),
    ]);
    try {
      vi.stubEnv("EXPO_OS", "ios");
      await publishWidgetSnapshot();
      const watch = JSON.parse(publishSnapshot.mock.calls[0]?.[0] ?? "{}");
      expect(watch.conventions[0].events[0].summary).toBe("About saved");
      expect(watch.conventions[0].options[0]).toMatchObject({
        id: "option",
        summary: "About option",
        reminderMinutes: null,
      });
      const phone = JSON.stringify(publishPhoneWidget.mock.calls[0]?.[0]);
      expect(phone).not.toContain("summary");
      expect(phone).not.toContain("options");

      vi.stubEnv("EXPO_OS", "android");
      await publishWidgetSnapshot();
      const android = publishSnapshot.mock.calls[1]?.[0] ?? "";
      expect(android).not.toContain("summary");
      expect(android).not.toContain("options");
    } finally {
      vi.unstubAllEnvs();
      getAll.mockReset();
      getByConventionId.mockResolvedValue([]);
    }
  });

  it("never builds two snapshots at once and coalesces mid-flight triggers", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<() => void> = [];

    getAll.mockImplementation(() => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise((resolve) => {
        releases.push(() => {
          inFlight -= 1;
          resolve([]);
        });
      });
    });

    // First call starts a build; the next three arrive while it is still
    // reading and must collapse into exactly one follow-up run.
    const calls = [
      publishWidgetSnapshot(),
      publishWidgetSnapshot(),
      publishWidgetSnapshot(),
      publishWidgetSnapshot(),
    ];

    await vi.waitFor(() => expect(releases).toHaveLength(1));
    releases[0]?.();

    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases[1]?.();

    await Promise.all(calls);

    expect(maxInFlight).toBe(1);
    expect(getAll).toHaveBeenCalledTimes(2);
    expect(publishSnapshot).toHaveBeenCalledTimes(2);
  });

  it("reconciles the tracked event without waiting on it or failing with it", async () => {
    reconcileTrackedEvent.mockClear();
    reconcileTrackedEvent.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => reject(new Error("db"))),
    );
    getAll.mockResolvedValueOnce([]);
    await expect(publishWidgetSnapshot()).resolves.toBe(true);
    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        scope: "tracked-event.reconcile",
      }),
    );
    expect(reconcileTrackedEvent).toHaveBeenCalledTimes(1);
  });

  it("still reconciles the tracked event when the publication fails", async () => {
    // A widget fault must not leave a finished or cancelled event tracked.
    reconcileTrackedEvent.mockClear();
    getAll.mockRejectedValueOnce(new Error("database is closed"));
    await expect(publishWidgetSnapshot()).rejects.toThrow("database is closed");
    await vi.waitFor(() =>
      expect(reconcileTrackedEvent).toHaveBeenCalledTimes(1),
    );
  });

  it("recovers after a failed build", async () => {
    getAll.mockRejectedValueOnce(new Error("database is closed"));
    await expect(publishWidgetSnapshot()).rejects.toThrow("database is closed");

    getAll.mockResolvedValueOnce([]);
    await expect(publishWidgetSnapshot()).resolves.toBe(true);
  });
});
