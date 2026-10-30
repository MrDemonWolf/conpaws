import type { MaterialColors } from "@expo/ui/jetpack-compose";

export type MaterialThemeColors = Pick<
  MaterialColors,
  | "surface"
  | "onSurface"
  | "surfaceContainer"
  | "surfaceContainerHigh"
  | "onSurfaceVariant"
  | "secondaryContainer"
  | "onSecondaryContainer"
  | "outlineVariant"
  | "error"
>;

/** React Native and Compose use these roles from the same generated palette. */
export function materialNavigationColors(colors: MaterialThemeColors) {
  return {
    background: colors.surface,
    card: colors.surface,
    text: colors.onSurface,
    border: colors.outlineVariant,
    notification: colors.error,
  };
}

/** Override only neutral NativeWind roles; contextual status pairs stay intact. */
export function materialThemeVariables(colors: MaterialThemeColors) {
  return {
    "--color-background": colors.surface,
    "--color-foreground": colors.onSurface,
    "--color-card": colors.surfaceContainer,
    "--color-card-foreground": colors.onSurface,
    "--color-secondary": colors.secondaryContainer,
    "--color-secondary-foreground": colors.onSecondaryContainer,
    "--color-muted": colors.surfaceContainerHigh,
    "--color-muted-foreground": colors.onSurfaceVariant,
    "--color-accent": colors.secondaryContainer,
    "--color-accent-foreground": colors.onSecondaryContainer,
    "--color-border": colors.outlineVariant,
    "--color-input": colors.outlineVariant,
  } as const;
}
