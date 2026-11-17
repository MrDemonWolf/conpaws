import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn<(key: string) => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorage,
}));

type Storage = typeof import("./tracked-event-storage");
let storage: Storage;

const selection = {
  eventId: "evt_1",
  conventionId: "con_1",
  startedAtMs: 1_780_000_000_000,
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  asyncStorage.setItem.mockResolvedValue(undefined);
  asyncStorage.removeItem.mockResolvedValue(undefined);
  storage = await import("./tracked-event-storage");
});

describe("loadTrackedEventSelection", () => {
  it("is null until loaded", () => {
    expect(storage.getCachedTrackedEventSelection()).toBeNull();
  });

  it("reads and caches a valid selection", async () => {
    asyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(selection));
    await expect(storage.loadTrackedEventSelection()).resolves.toEqual(
      selection,
    );
    expect(asyncStorage.getItem).toHaveBeenCalledWith("trackedEvent");
    expect(storage.getCachedTrackedEventSelection()).toEqual(selection);
  });

  it.each([
    ["nothing stored", null],
    ["bad JSON", "{not json"],
    ["a string", JSON.stringify("evt_1")],
    ["a missing event id", JSON.stringify({ ...selection, eventId: "" })],
    [
      "a numeric convention id",
      JSON.stringify({ ...selection, conventionId: 4 }),
    ],
    ["a missing start", JSON.stringify({ ...selection, startedAtMs: null })],
  ])("reads %s as nothing tracked", async (_name, stored) => {
    asyncStorage.getItem.mockResolvedValueOnce(stored);
    await expect(storage.loadTrackedEventSelection()).resolves.toBeNull();
    expect(storage.getCachedTrackedEventSelection()).toBeNull();
  });

  it("reads a failed read as nothing tracked", async () => {
    asyncStorage.getItem.mockRejectedValueOnce(new Error("disk"));
    await expect(storage.loadTrackedEventSelection()).resolves.toBeNull();
  });

  it("keeps only the known fields", async () => {
    asyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({ ...selection, extra: "x" }),
    );
    await expect(storage.loadTrackedEventSelection()).resolves.toEqual(
      selection,
    );
  });
});

describe("saveTrackedEventSelection", () => {
  it("writes and caches", async () => {
    await storage.saveTrackedEventSelection(selection);
    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      "trackedEvent",
      JSON.stringify(selection),
    );
    expect(storage.getCachedTrackedEventSelection()).toEqual(selection);
  });

  it("rejects and rolls the cache back when the write fails", async () => {
    asyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(selection));
    await storage.loadTrackedEventSelection();
    asyncStorage.setItem.mockRejectedValueOnce(new Error("disk full"));

    await expect(
      storage.saveTrackedEventSelection({ ...selection, eventId: "evt_2" }),
    ).rejects.toThrow("disk full");
    expect(storage.getCachedTrackedEventSelection()).toEqual(selection);
  });
});

describe("clearTrackedEventSelection", () => {
  it("removes the stored value", async () => {
    await storage.saveTrackedEventSelection(selection);
    await storage.clearTrackedEventSelection();
    expect(asyncStorage.removeItem).toHaveBeenCalledWith("trackedEvent");
    expect(storage.getCachedTrackedEventSelection()).toBeNull();
  });

  it("rejects on failure but stays cleared in memory", async () => {
    await storage.saveTrackedEventSelection(selection);
    asyncStorage.removeItem.mockRejectedValueOnce(new Error("disk"));
    await expect(storage.clearTrackedEventSelection()).rejects.toThrow("disk");
    expect(storage.getCachedTrackedEventSelection()).toBeNull();
  });
});
