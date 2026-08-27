import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const haptics = vi.hoisted(() => ({
  impactAsync: vi.fn(async (_style: string) => undefined),
  notificationAsync: vi.fn(async (_type: string) => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

vi.mock("expo-haptics", () => haptics);

/**
 * `isAndroid` is read once at module load, so the platform has to be stubbed
 * before the import rather than inside the test body.
 */
async function loadHaptics(os = "ios") {
  vi.resetModules();
  vi.stubEnv("EXPO_OS", os);
  return import("./haptics");
}

describe("semantic haptics", () => {
  beforeEach(() => {
    haptics.impactAsync.mockClear().mockResolvedValue(undefined);
    haptics.notificationAsync.mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets no helper reach the device while the Settings toggle is off", async () => {
    const module = await loadHaptics();

    module.setHapticsEnabled(false);
    expect(module.getHapticsEnabled()).toBe(false);

    module.hapticSuccess();
    module.hapticToggle(true);
    module.hapticToggle(false);
    module.hapticLongPress();
    module.hapticTap();

    expect(haptics.impactAsync).not.toHaveBeenCalled();
    expect(haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it("fires each helper with its documented feedback style once re-enabled", async () => {
    const module = await loadHaptics();

    module.setHapticsEnabled(false);
    module.setHapticsEnabled(true);
    expect(module.getHapticsEnabled()).toBe(true);

    module.hapticSuccess();
    expect(haptics.notificationAsync).toHaveBeenCalledExactlyOnceWith(
      "success",
    );

    // Direction is deliberately audible: on is heavier than off.
    module.hapticToggle(true);
    module.hapticToggle(false);
    module.hapticLongPress();
    module.hapticTap();

    expect(haptics.impactAsync.mock.calls.map(([style]) => style)).toEqual([
      "medium",
      "light",
      "medium",
      "light",
    ]);
  });

  it("keeps tap feedback off Android, where the ripple already answers", async () => {
    const module = await loadHaptics("android");
    module.setHapticsEnabled(true);

    module.hapticTap();
    expect(haptics.impactAsync).not.toHaveBeenCalled();

    // Only the plain tap is suppressed; the other events still play, or the
    // whole platform would go silent.
    module.hapticLongPress();
    module.hapticSuccess();
    expect(haptics.impactAsync).toHaveBeenCalledExactlyOnceWith("medium");
    expect(haptics.notificationAsync).toHaveBeenCalledExactlyOnceWith(
      "success",
    );
  });

  it("swallows a device that refuses the effect", async () => {
    const module = await loadHaptics();
    module.setHapticsEnabled(true);

    const rejection = Promise.reject(new Error("no vibrator"));
    haptics.impactAsync.mockReturnValue(rejection);

    expect(() => module.hapticLongPress()).not.toThrow();
    // An unhandled rejection here would fail the run, which is the point: the
    // action that triggered the haptic must not be taken down with it.
    await expect(rejection.catch(() => "handled")).resolves.toBe("handled");
  });
});
