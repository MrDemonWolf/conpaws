export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];

export function parseAppearancePreference(
  value: unknown,
): AppearancePreference {
  return APPEARANCE_PREFERENCES.includes(value as AppearancePreference)
    ? (value as AppearancePreference)
    : "system";
}

export function toNativeColorScheme(
  preference: AppearancePreference,
): "unspecified" | "light" | "dark" {
  return preference === "system" ? "unspecified" : preference;
}
