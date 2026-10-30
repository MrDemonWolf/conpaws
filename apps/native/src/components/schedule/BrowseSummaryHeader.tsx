import { Pressable, View } from "react-native";
import { PRESS_DIM, Text } from "@/components/ui";

interface BrowseSummaryHeaderProps {
  /** "2–3 PM" or "Saturday · all times". */
  heading: string;
  /** "8 options" */
  countLabel: string;
  /** "12 total", only when a category or search narrowed the list. */
  totalLabel?: string;
  /** The active category with a way to drop it, or the reassuring default line. */
  hint: { text: string; actionLabel?: string; onAction?: () => void };
}

/** The line above the Browse rows that says what the list currently is. */
export function BrowseSummaryHeader({
  heading,
  countLabel,
  totalLabel,
  hint,
}: BrowseSummaryHeaderProps) {
  return (
    <View className="gap-1 px-4 pt-4 pb-1">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Text variant="h3" className="shrink">
          {heading}
        </Text>
        <Text variant="caption" className="tabular-nums">
          {totalLabel ? `${countLabel} · ${totalLabel}` : countLabel}
        </Text>
      </View>
      <View className="flex-row flex-wrap items-center gap-x-2">
        <Text variant="caption">{hint.text}</Text>
        {hint.actionLabel && hint.onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hint.actionLabel}
            hitSlop={8}
            onPress={hint.onAction}
            className={PRESS_DIM}
          >
            <Text variant="caption" className="font-semibold text-primary">
              {hint.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
