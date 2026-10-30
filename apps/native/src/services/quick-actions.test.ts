import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  module: null as null | {
    consumePendingQuickAction: ReturnType<typeof vi.fn>;
    setQuickActionLabels?: ReturnType<typeof vi.fn>;
    addListener?: ReturnType<typeof vi.fn>;
  },
  legacy: null as null | {
    consumePendingQuickAction: ReturnType<typeof vi.fn>;
  },
  i18n: {
    isInitialized: true,
    t: (key: string) => `translated:${key}`,
  },
}));

vi.mock("expo", () => ({
  requireOptionalNativeModule: (name: string) =>
    name === "ConPawsQuickActions" ? bridge.module : bridge.legacy,
}));
vi.mock("@/lib/i18n", () => ({ default: bridge.i18n }));

describe("launcher native bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    bridge.module = null;
    bridge.legacy = null;
    bridge.i18n.isInitialized = true;
    bridge.i18n.t = (key: string) => `translated:${key}`;
  });

  it("works without a native bridge", async () => {
    const service = await import("./quick-actions");
    expect(service.consumePendingQuickAction(true)).toBeNull();
    await expect(service.updateQuickActionLabels()).resolves.toBe(false);
    expect(() => service.subscribeToQuickActions(vi.fn())()).not.toThrow();
  });

  it("retains pending-action support in older Apple binaries", async () => {
    bridge.legacy = {
      consumePendingQuickAction: vi.fn().mockReturnValue("/schedule"),
    };
    const service = await import("./quick-actions");
    expect(service.consumePendingQuickAction(true)).toBe("/schedule");
    await expect(service.updateQuickActionLabels()).resolves.toBe(false);
  });

  it("retains a parked action until navigation and onboarding are ready", async () => {
    const consume = vi
      .fn()
      .mockReturnValueOnce("/schedule")
      .mockReturnValue(null);
    bridge.module = { consumePendingQuickAction: consume };
    const service = await import("./quick-actions");

    expect(service.consumePendingQuickAction(false)).toBeNull();
    expect(consume).not.toHaveBeenCalled();
    expect(service.consumePendingQuickAction(true)).toBe("/schedule");
    expect(service.consumePendingQuickAction(true)).toBeNull();
  });

  it("updates the four native labels from the current app language", async () => {
    const setLabels = vi.fn().mockResolvedValue(true);
    bridge.module = {
      consumePendingQuickAction: vi.fn(),
      setQuickActionLabels: setLabels,
    };
    const service = await import("./quick-actions");
    await service.updateQuickActionLabels();
    bridge.i18n.t = (key: string) => `new-language:${key}`;
    await service.updateQuickActionLabels();
    expect(setLabels).toHaveBeenLastCalledWith({
      schedule: "new-language:schedule.title",
      find: "new-language:home.find",
      create: "new-language:convention.create",
      import: "new-language:convention.importSchedule",
    });
    expect(setLabels).toHaveBeenCalledTimes(2);
  });

  it("waits for translations and propagates registration failures for reporting", async () => {
    const setLabels = vi.fn().mockRejectedValue(new Error("Native failure"));
    bridge.module = {
      consumePendingQuickAction: vi.fn(),
      setQuickActionLabels: setLabels,
    };
    const service = await import("./quick-actions");
    bridge.i18n.isInitialized = false;
    await expect(service.updateQuickActionLabels()).resolves.toBe(false);
    expect(setLabels).not.toHaveBeenCalled();
    bridge.i18n.isInitialized = true;
    await expect(service.updateQuickActionLabels()).rejects.toThrow(
      "Native failure",
    );
  });

  it("subscribes to warm actions and removes the native listener on cleanup", async () => {
    const remove = vi.fn();
    const addListener = vi.fn().mockReturnValue({ remove });
    bridge.module = {
      consumePendingQuickAction: vi
        .fn()
        .mockReturnValueOnce("/convention/create")
        .mockReturnValue(null),
      addListener,
    };
    const service = await import("./quick-actions");
    const listener = vi.fn();
    const unsubscribe = service.subscribeToQuickActions(listener);
    expect(addListener).toHaveBeenCalledWith("onQuickAction", listener);
    expect(service.consumePendingQuickAction(true)).toBe("/convention/create");
    expect(service.consumePendingQuickAction(true)).toBeNull();
    unsubscribe();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
