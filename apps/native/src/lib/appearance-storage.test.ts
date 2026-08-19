import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorage,
}));
vi.mock("react-native", () => ({
  Appearance: { setColorScheme: vi.fn() },
}));

import {
  applyAppearancePreference,
  saveAppearancePreference,
  subscribeAppearancePreference,
} from "./appearance-storage";

describe("appearance preference store", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifies active subscribers only when the preference changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAppearancePreference(listener);

    applyAppearancePreference("dark");
    applyAppearancePreference("dark");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    applyAppearancePreference("light");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reads the preference back before accepting the save", async () => {
    asyncStorage.getItem.mockResolvedValueOnce("light");
    await expect(saveAppearancePreference("light")).resolves.toBeUndefined();
    expect(asyncStorage.setItem).toHaveBeenCalledWith("appAppearance", "light");

    asyncStorage.getItem.mockResolvedValueOnce("system");
    await expect(saveAppearancePreference("light")).rejects.toThrow(
      "Appearance preference was not persisted",
    );
  });
});
