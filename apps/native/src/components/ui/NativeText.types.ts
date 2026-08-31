import type { TextProps } from "@expo/ui";

export type NativeTextProps = TextProps & {
  /**
   * Which theme token to paint with on Android. Ignored on iOS, which keeps
   * SwiftUI's own label colours.
   */
  tone?: "muted" | "foreground";
};
