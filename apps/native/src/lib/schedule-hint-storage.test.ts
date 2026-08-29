import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

describe("schedule hint storage", () => {
  beforeEach(async () => {
    store.clear();
    vi.resetModules();
  });

  it("defaults to not dismissed", async () => {
    const { isScheduleHintDismissed } = await import("./schedule-hint-storage");
    expect(await isScheduleHintDismissed()).toBe(false);
  });

  it("stays dismissed after dismissal, across cache resets", async () => {
    const first = await import("./schedule-hint-storage");
    await first.dismissScheduleHint();
    expect(await first.isScheduleHintDismissed()).toBe(true);

    vi.resetModules(); // simulate a fresh launch reading from storage
    const second = await import("./schedule-hint-storage");
    expect(await second.isScheduleHintDismissed()).toBe(true);
  });

  it("reset clears both cache and storage", async () => {
    const mod = await import("./schedule-hint-storage");
    await mod.dismissScheduleHint();
    await mod.resetScheduleHint();
    expect(await mod.isScheduleHintDismissed()).toBe(false);
  });
});
