import { beforeEach, describe, expect, it, vi } from "vitest";

const publishSnapshot = vi.fn(() => true);
const getAll = vi.fn();

vi.mock("expo", () => ({
  requireOptionalNativeModule: () => ({ publishSnapshot }),
}));
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
    getAll.mockReset();
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

  it("recovers after a failed build", async () => {
    getAll.mockRejectedValueOnce(new Error("database is closed"));
    await expect(publishWidgetSnapshot()).rejects.toThrow("database is closed");

    getAll.mockResolvedValueOnce([]);
    await expect(publishWidgetSnapshot()).resolves.toBe(true);
  });
});
