/**
 * JS mirror of the global.css tokens that components need imperatively —
 * spinner colors, icon tints, anything passed as a prop rather than a
 * className. NativeWind can only see class names, so these values have to
 * exist in JS too; `theme-tokens.test.ts` parses global.css and fails the
 * moment either side drifts.
 *
 * Only tokens with an imperative consumer belong here. Styling that can be a
 * className stays a className.
 */
export const themeTokens = {
  light: {
    primary: "#005575",
    primaryForeground: "#ffffff",
    foreground: "#0f172a",
    destructive: "#991b1b",
    destructiveForeground: "#ffffff",
    infoForeground: "#1e40af",
    successForeground: "#14532d",
    mutedForeground: "#5c667a",
  },
  dark: {
    primary: "#18b7f2",
    primaryForeground: "#000000",
    foreground: "#ffffff",
    destructive: "#ff6961",
    destructiveForeground: "#000000",
    infoForeground: "#bfdbfe",
    successForeground: "#bbf7d0",
    mutedForeground: "#aeb4c0",
  },
} as const;

export type ThemeScheme = keyof typeof themeTokens;
