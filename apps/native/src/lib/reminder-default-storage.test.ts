import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn() }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: storage,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  storage.setItem.mockResolvedValue(undefined);
});

describe("default reminder preference", () => {
  it("defaults a fresh install to 15 minutes and persists it before onboarding completes", async () => {
    storage.getItem.mockResolvedValue(null);
    const preference = await import("./reminder-default-storage");
    expect(await preference.getDefaultReminderMinutes()).toBe(15);
    expect(storage.setItem).toHaveBeenCalledWith(
      "reminderDefaultMinutes",
      "15",
    );
  });

  it("preserves the old None default for an existing install with no stored preference", async () => {
    storage.getItem.mockImplementation(async (key) =>
      key === "hasCompletedOnboarding" ? "true" : null,
    );
    const preference = await import("./reminder-default-storage");
    expect(await preference.getDefaultReminderMinutes()).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(
      "reminderDefaultMinutes",
      "none",
    );
  });

  it.each([
    ["none", null],
    ["0", 0],
    ["30", 30],
    ["broken", null],
  ])("preserves stored %s", async (stored, expected) => {
    storage.getItem.mockResolvedValue(stored);
    const preference = await import("./reminder-default-storage");
    expect(await preference.getDefaultReminderMinutes()).toBe(expected);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("keeps explicit None across a cold launch", async () => {
    const preference = await import("./reminder-default-storage");
    await preference.setDefaultReminderMinutes(null);
    storage.getItem.mockResolvedValue("none");
    vi.resetModules();
    expect(
      await (
        await import("./reminder-default-storage")
      ).getDefaultReminderMinutes(),
    ).toBeNull();
  });

  it("keeps the cached preference when a write fails", async () => {
    storage.getItem.mockResolvedValue("30");
    const preference = await import("./reminder-default-storage");
    await preference.getDefaultReminderMinutes();
    storage.setItem.mockRejectedValue(new Error("disk full"));
    await expect(preference.setDefaultReminderMinutes(null)).rejects.toThrow(
      "disk full",
    );
    expect(preference.getCachedDefaultReminderMinutes()).toBe(30);
  });

  it("does not treat unreadable storage as a new install", async () => {
    storage.getItem.mockRejectedValue(new Error("unavailable"));
    const preference = await import("./reminder-default-storage");
    expect(await preference.getDefaultReminderMinutes()).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
