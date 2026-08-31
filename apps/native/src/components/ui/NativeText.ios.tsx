import { Text as ExpoText } from "@expo/ui";

import type { NativeTextProps } from "./NativeText.types";

/**
 * Pass-through.
 *
 * SwiftUI resolves an unset foreground against the current appearance, so
 * these run as system label colours -- with the vibrancy and Increase
 * Contrast handling that comes free from leaving it unset. Setting a colour
 * here would replace all of that with a flat hex.
 *
 * `tone` is accepted and dropped: it describes the Android workaround in
 * `NativeText.tsx`, not anything iOS needs.
 */
export function NativeText({ tone: _tone, ...props }: NativeTextProps) {
  return <ExpoText {...props} />;
}
