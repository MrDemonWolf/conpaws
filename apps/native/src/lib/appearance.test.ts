import { describe, expect, it } from "vitest";
import { parseAppearancePreference, toNativeColorScheme } from "./appearance";

describe("appearance preference", () => {
  it("accepts saved preferences and rejects invalid storage values", () => {
    expect(parseAppearancePreference("system")).toBe("system");
    expect(parseAppearancePreference("light")).toBe("light");
    expect(parseAppearancePreference("dark")).toBe("dark");
    expect(parseAppearancePreference("sepia")).toBe("system");
    expect(parseAppearancePreference(null)).toBe("system");
  });

  it("maps choices to React Native appearance values", () => {
    expect(toNativeColorScheme("system")).toBe("unspecified");
    expect(toNativeColorScheme("light")).toBe("light");
    expect(toNativeColorScheme("dark")).toBe("dark");
  });
});
