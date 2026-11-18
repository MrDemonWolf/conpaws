import { View, type ViewProps } from "react-native";
import { useWidthCap } from "@/hooks/useContentWidth";
import { READABLE_MAX } from "@/lib/content-width";

interface ReadableColumnProps extends ViewProps {
  /** The cap, from `lib/content-width.ts`. Defaults to the readable column. */
  max?: number;
  /**
   * Whether the cap includes side gutters. Leave on for a block that draws
   * its own `px-4`; turn off inside a parent that already pads.
   */
  gutter?: boolean;
}

/**
 * A block that stops widening at a readable width and centres itself in a
 * wide window. In a window that is not roomy it is a plain View, so phones in
 * either orientation lay out exactly as before.
 *
 * Wrapping changes nothing on a phone only when the children do not rely on
 * their old parent's flex: move `flex-1` and `gap` onto this column.
 */
export function ReadableColumn({
  max = READABLE_MAX,
  gutter = true,
  style,
  ...props
}: ReadableColumnProps) {
  const capStyle = useWidthCap()(max, { gutter });
  return <View {...props} style={capStyle ? [capStyle, style] : style} />;
}
