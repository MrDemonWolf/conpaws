import type { ReactNode } from "react";
import { Pressable, type PressableProps, View } from "react-native";

import { cn } from "@/lib/utils";

/**
 * The press-dim every tappable surface uses.
 *
 * `Button.tsx` already claims this is uniform across the app ("raw Pressables
 * across the app use the same modifier, so pressed feedback stays uniform") and
 * it was not: the same gesture rendered at opacity 60, 65 and 70 depending on
 * which screen you were on. Exporting it is what makes the claim true, so
 * import this rather than retyping `active:opacity-*`.
 */
export const PRESS_DIM = "active:opacity-60";

/**
 * Minimum height for anything tappable: 48 satisfies both platform minimums,
 * HIG's 44pt and Material 3's 48dp. Several rows sat at `min-h-11` (44px),
 * which clears iOS and misses Android.
 */
export const TAP_TARGET = "min-h-12";

interface RowProps extends Omit<PressableProps, "children" | "className"> {
  children: ReactNode;
  /** Rendered after the content, outside the flexing area — chevrons, ticks. */
  trailing?: ReactNode;
  /** Border, rounding and background stay per-site; the shared part is above. */
  className?: string;
}

/**
 * A tappable list row: one minimum height, one press-dim, content and an
 * optional trailing marker.
 *
 * Deliberately thin. The six row-shaped surfaces in this app disagree about
 * borders, rounding and background — grouped lists round only their first and
 * last child, standalone links round all four — and folding those into props
 * would trade six short class strings for one component with a `variant` union
 * nobody could read. Those stay in `className`. What is shared, and what was
 * actually drifting, is the height and the press feedback.
 *
 * `EventItem` and `ConventionCard` do not use this — their internals are too
 * structured to pour through a `children` slot — but they import `PRESS_DIM`
 * and `TAP_TARGET` so the feedback still matches.
 */
export function Row({ children, trailing, className, ...props }: RowProps) {
  return (
    <Pressable
      className={cn(
        TAP_TARGET,
        "flex-row items-center gap-3",
        PRESS_DIM,
        className,
      )}
      style={{ borderCurve: "continuous" }}
      {...props}
    >
      <View className="flex-1">{children}</View>
      {trailing}
    </Pressable>
  );
}
