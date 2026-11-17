import { beforeEach, describe, expect, it, vi } from "vitest";

const publishSnapshot = vi.fn((_json: string) => true);
const publishPhoneWidget = vi.fn();
const getAll = vi.fn();

vi.mock("expo", () => ({
  requireOptionalNativeModule: () => ({ publishSnapshot }),
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
vi.mock("@/db/repositories/events", () => ({
  getByConventionId: vi.fn(async () => []),
}));
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
