import { Text as ExpoText } from "@expo/ui";

import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";

import type { NativeTextProps } from "./NativeText.types";

/**
 * `@expo/ui`'s Text with a colour, for Android.
 *
 * Without one it renders **pure black in dark mode** -- measured at 1.13:1
 * against the `#0F1417` sheet background, where AA wants 4.5. Every
 * `FieldGroup.SectionFooter` in the app was affected, so the help text under
 * "Fetch Schedule", the timezone notes on convention create and edit, and the
 * name-length warnings were all invisible on a dark Android phone.
 *
 * The cause is upstream, not our theming: all 23 `<Host>`s already pass
 * `colorScheme`, but `@expo/ui`'s Android Text forwards `textStyle.color`
 * straight to Compose, and an absent colour lands on `LocalContentColor`,
 * which is black outside a Material text context. SwiftUI has no equivalent
 * gap, which is why this shipped unnoticed. Supplying the colour ourselves is
 * the whole workaround; when upstream inherits properly this file can go.
 *
 * Defaulting to `muted` rather than `foreground` because every call site but
 * the type specimens in the UI gallery is section-footer help text.
 */
export function NativeText({
  tone = "muted",
  textStyle,
  ...props
}: NativeTextProps) {
  const scheme = useResolvedColorScheme();
  const color =
    tone === "muted"
      ? themeTokens[scheme].mutedForeground
      : themeTokens[scheme].foreground;

  // Caller's own colour wins -- spread last.
  return <ExpoText {...props} textStyle={{ color, ...textStyle }} />;
}
