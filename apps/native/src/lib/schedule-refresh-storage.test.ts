import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  multiRemove: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorage,
}));

import {
  getScheduleAllCategories,
  getScheduleAutoCheck,
  getScheduleCheckedAt,
} from "./schedule-refresh-storage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("schedule refresh storage defaults", () => {
  it("treats a never-set auto-check as on", async () => {
    asyncStorage.getItem.mockResolvedValue(null);

    // Someone who imported by link did so because the link is the source of
    // truth. Defaulting off would make the feature invisible.
    expect(await getScheduleAutoCheck()).toBe(true);
  });

  it("treats a rejected read as on rather than throwing", async () => {
    vi.resetModules();
    asyncStorage.getItem.mockRejectedValue(new Error("storage unavailable"));

    const module = await import("./schedule-refresh-storage");
    expect(await module.getScheduleAutoCheck()).toBe(true);
  });

  it("treats an unrecorded category selection as filtered", async () => {
    asyncStorage.getItem.mockResolvedValue(null);

    // Conventions imported before this was tracked must never be silently
    // widened to categories the user may have deselected.
    expect(await getScheduleAllCategories("con-1")).toBe(false);
  });

  it("reads a stored check time and rejects a junk one", async () => {
    asyncStorage.getItem.mockResolvedValueOnce("1756000000000");
    expect(await getScheduleCheckedAt("con-1")).toBe(1756000000000);

    asyncStorage.getItem.mockResolvedValueOnce("not-a-number");
    expect(await getScheduleCheckedAt("con-1")).toBeNull();
  });
});
