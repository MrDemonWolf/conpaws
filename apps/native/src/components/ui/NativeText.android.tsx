import { Text as ExpoText } from "@expo/ui";
import { useMaterialColors } from "@expo/ui/jetpack-compose";

import type { NativeTextProps } from "./NativeText.types";

/**
 * `@expo/ui`'s Text with a colour, for Android.
 *
 * Footer text previously rendered pure black on a dark Compose surface.
 * An explicit on-surface color keeps the help text in the same palette as
 * its FieldGroup, including the timezone notes on create and edit.
 *
 * These footers supply an explicit Material text role so supporting copy stays
 * subordinate to the row labels and matches the enclosing Host's seeded palette.
 *
 * Defaulting to `muted` rather than `foreground` because every call site but
 * the type specimens in the UI gallery is section-footer help text.
 */
export function NativeText({
  tone = "muted",
  textStyle,
  ...props
}: NativeTextProps) {
  // The enclosing Host already cached the exact seeded Compose palette.
  const colors = useMaterialColors();
  const color = tone === "muted" ? colors.onSurfaceVariant : colors.onSurface;

  // Caller's own colour wins -- spread last.
  return <ExpoText {...props} textStyle={{ color, ...textStyle }} />;
}
