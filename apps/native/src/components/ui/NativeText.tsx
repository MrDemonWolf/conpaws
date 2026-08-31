import { Text as ExpoText, type TextProps } from "@expo/ui";
import { Platform } from "react-native";

import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";

/**
 * `@expo/ui`'s Text with a colour.
 *
 * Without one it renders **pure black on Android in dark mode** -- measured at
 * 1.13:1 against the `#0F1417` sheet background, where AA wants 4.5. Every
 * `FieldGroup.SectionFooter` in the app was affected, so the help text under
 * "Fetch Schedule", the timezone notes on create and edit, and the name-length
 * warnings were all invisible on a dark Android phone. iOS was fine, which is
 * why it survived: SwiftUI resolves an unset foreground against the system
 * appearance, and Jetpack Compose does not.
 *
 * Defaulting to `muted` rather than `foreground` because every call site but
 * the type specimens in the UI gallery is section-footer help text.
 *
 * Android only, deliberately. `@expo/ui`'s iOS Text turns `textStyle.color`
 * into a `foregroundStyle` modifier, which would replace SwiftUI's system
 * secondary label -- and with it the vibrancy and Increase Contrast handling
 * that comes free from leaving it unset. iOS already renders these footers
 * correctly, so it keeps what it has.
 */
export function NativeText({
  tone = "muted",
  textStyle,
  ...props
}: TextProps & { tone?: "muted" | "foreground" }) {
  const scheme = useResolvedColorScheme();
  const color =
    Platform.OS === "android"
      ? tone === "muted"
        ? themeTokens[scheme].mutedForeground
        : themeTokens[scheme].foreground
      : undefined;

  // Caller's own colour wins -- spread last.
  return <ExpoText {...props} textStyle={{ color, ...textStyle }} />;
}
