import { useCallback, useMemo } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ContentWidth, capWidth, contentWidth } from "@/lib/content-width";

/**
 * The readable column for the current window (see `lib/content-width.ts`).
 *
 * Reads `useWindowDimensions()` and the safe area on every render, so an iPad
 * rotation, a Split View or Stage Manager resize, or folding a Duo all
 * re-render with new values. Never cache these at module scope or on mount.
 *
 * The insets are window-based, so use them only at a full-window root: a
 * screen's own list or form. Inside a form sheet the window is wider than the
 * sheet; use `useWidthCap()` there instead, which follows the container.
 */
export function useContentWidth(): ContentWidth {
  const { width, height, fontScale } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  return useMemo(
    () =>
      contentWidth({
        width,
        height,
        fontScale,
        safeLeft: left,
        safeRight: right,
      }),
    [width, height, fontScale, left, right],
  );
}

export type WidthCap = (
  max: number,
  options?: { gutter?: boolean },
) => ViewStyle | undefined;

/**
 * Returns a function that caps a full-width block at `max` and centres it, or
 * returns undefined when the window is not roomy so phones keep their layout
 * exactly. `gutter: false` for a block that sits inside a parent's padding
 * rather than drawing its own `px-4`.
 */
export function useWidthCap(): WidthCap {
  const { width, height, fontScale } = useWindowDimensions();
  return useCallback(
    (max, options) => {
      const maxWidth = capWidth(max, { width, height, fontScale }, options);
      return maxWidth === undefined
        ? undefined
        : { width: "100%", maxWidth, alignSelf: "center" };
    },
    [width, height, fontScale],
  );
}
