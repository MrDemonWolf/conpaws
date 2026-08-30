import { View, type ViewProps } from "react-native";

import { cn } from "@/lib/utils";

/**
 * The bordered surface used for grouped, non-tappable content.
 *
 * This existed four times as a pasted class string and the four disagreed:
 * three carried `borderCurve: "continuous"` and one did not, and the onboarding
 * copy had no border at all. On iOS that difference is visible — a continuous
 * corner and a circular one of the same radius are noticeably different shapes
 * side by side, which is exactly the situation on the convention screen.
 *
 * Padding is a prop rather than fixed because the license body needs `p-4` and
 * the onboarding row needs its own; everything else about the surface is not
 * negotiable and lives here.
 */
export function Card({ className, style, children, ...props }: ViewProps) {
  return (
    <View
      className={cn("rounded-2xl border border-border bg-card p-4", className)}
      style={[{ borderCurve: "continuous" }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
