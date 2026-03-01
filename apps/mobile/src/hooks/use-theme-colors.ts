import { useColorScheme } from "@/lib/useColorScheme";

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  gold: string;
  verified: string;
}

const lightColors: ThemeColors = {
  background: "#ffffff",
  foreground: "#0a0a0a",
  card: "#ffffff",
  cardForeground: "#0a0a0a",
  primary: "#6D28D9",
  primaryForeground: "#ffffff",
  secondary: "#f5f5f4",
  secondaryForeground: "#1c1917",
  muted: "#f5f5f4",
  mutedForeground: "#78716c",
  accent: "#f5f5f4",
  accentForeground: "#1c1917",
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  border: "#e7e5e4",
  input: "#e7e5e4",
  ring: "#6D28D9",
  gold: "#f59e0b",
  verified: "#22c55e",
};

const darkColors: ThemeColors = {
  background: "#0a0a0a",
  foreground: "#fafaf9",
  card: "#1c1917",
  cardForeground: "#fafaf9",
  primary: "#8b5cf6",
  primaryForeground: "#ffffff",
  secondary: "#292524",
  secondaryForeground: "#fafaf9",
  muted: "#292524",
  mutedForeground: "#a8a29e",
  accent: "#292524",
  accentForeground: "#fafaf9",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  border: "#44403c",
  input: "#44403c",
  ring: "#8b5cf6",
  gold: "#fbbf24",
  verified: "#4ade80",
};

export function useThemeColors(): ThemeColors {
  const { isDark } = useColorScheme();
  return isDark ? darkColors : lightColors;
}
