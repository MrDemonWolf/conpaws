import { Image } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  background,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";

import type {
  SettingsIconName,
  SettingsLeadingIconProps,
} from "./SettingsLeadingIcon.types";

/**
 * A white SF Symbol on a coloured rounded square, the way iOS Settings marks
 * its rows. SwiftUI draws it natively, so it follows Dynamic Type and the
 * row's own layout without React Native interop.
 *
 * The tile colours are iOS system colours and stay the same in dark mode, as
 * they do in iOS Settings. Each one keeps a white glyph above 3:1 contrast.
 */
export const SETTINGS_ICON_TILES: Record<
  SettingsIconName,
  { symbol: string; color: string }
> = {
  theme: { symbol: "paintpalette.fill", color: "#5856D6" },
  haptics: { symbol: "iphone.radiowaves.left.and.right", color: "#FF2D55" },
  language: { symbol: "globe", color: "#007AFF" },
  time: { symbol: "clock.fill", color: "#8E8E93" },
  notifications: { symbol: "bell.badge.fill", color: "#FF3B30" },
  reminder: { symbol: "alarm.fill", color: "#FF9500" },
  updates: { symbol: "arrow.triangle.2.circlepath", color: "#34C759" },
  export: { symbol: "square.and.arrow.up", color: "#007AFF" },
  import: { symbol: "square.and.arrow.down", color: "#30B0C7" },
  help: { symbol: "questionmark", color: "#32ADE6" },
  about: { symbol: "info", color: "#8E8E93" },
  privacy: { symbol: "hand.raised.fill", color: "#007AFF" },
  terms: { symbol: "doc.text.fill", color: "#8E8E93" },
  preview: { symbol: "testtube.2", color: "#AF52DE" },
  debug: { symbol: "ladybug.fill", color: "#636366" },
};

const TILE_SIZE = 29;

export function SettingsLeadingIcon({ name }: SettingsLeadingIconProps) {
  const tile = SETTINGS_ICON_TILES[name];
  return (
    <Image
      // biome-ignore lint/suspicious/noExplicitAny: SF Symbol names are a closed union in @expo/ui; these are checked by the tile test.
      systemName={tile.symbol as any}
      size={16}
      color="white"
      modifiers={[
        frame({ width: TILE_SIZE, height: TILE_SIZE }),
        background(tile.color, shapes.roundedRectangle({ cornerRadius: 7 })),
        // Decorative: the row title already says what the row is.
        accessibilityHidden(true),
      ]}
    />
  );
}
