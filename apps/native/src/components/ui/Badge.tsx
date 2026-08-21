import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

export type BadgeVariant =
  | "upcoming"
  | "active"
  | "ended"
  | "info"
  | "neutral"
  | "age-teen"
  | "age-mature"
  | "age-adult";

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  /**
   * `strong` raises the label to semibold and adds a hairline border. Use it
   * for information the reader must not skim past, such as an age gate.
   */
  emphasis?: "normal" | "strong";
  className?: string;
}

/**
 * Every colour here resolves to a theme token, never a raw Tailwind palette
 * class. The token pairs are asserted at WCAG AAA for small text in both
 * themes by `theme-contrast.test.ts`; palette classes were untestable and had
 * drifted to failing values in dark mode.
 */
const variantStyles: Record<
  BadgeVariant,
  { container: string; text: string; border: string }
> = {
  upcoming: {
    container: "bg-info",
    text: "text-info-foreground",
    border: "border-info-foreground/20",
  },
  active: {
    container: "bg-success",
    text: "text-success-foreground",
    border: "border-success-foreground/20",
  },
  ended: {
    container: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
  info: {
    container: "bg-info",
    text: "text-info-foreground",
    border: "border-info-foreground/20",
  },
  neutral: {
    container: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
  "age-teen": {
    container: "bg-age-teen",
    text: "text-age-teen-foreground",
    border: "border-age-teen-foreground/25",
  },
  "age-mature": {
    container: "bg-age-mature",
    text: "text-age-mature-foreground",
    border: "border-age-mature-foreground/30",
  },
  "age-adult": {
    container: "bg-age-adult",
    text: "text-age-adult-foreground",
    border: "border-age-adult-foreground/35",
  },
};

export function Badge({
  variant,
  label,
  emphasis = "normal",
  className,
}: BadgeProps) {
  const styles = variantStyles[variant];
  const strong = emphasis === "strong";

  return (
    <View
      className={cn(
        "rounded-full px-2.5 py-1",
        styles.container,
        strong && cn("border", styles.border),
        className,
      )}
    >
      <Text
        // Pill text does not scale past 1.4x: the row is already dense, and an
        // age badge that wraps to three lines stops reading as a badge.
        maxFontSizeMultiplier={1.4}
        className={cn(
          "text-xs",
          strong ? "font-semibold" : "font-medium",
          styles.text,
        )}
      >
        {label}
      </Text>
    </View>
  );
}
