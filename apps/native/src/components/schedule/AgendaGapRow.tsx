import { memo } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui";
import type { AgendaGap } from "@/lib/agenda-gaps";
import { cn } from "@/lib/utils";

interface AgendaGapRowProps {
  gap: AgendaGap;
  /** Already worded by the screen: "45 min free · Time to get there". */
  label: string;
}

/**
 * The quiet line between two saved events. Plain text, not a button: there
 * is nothing to do with a gap except know it is there.
 */
export const AgendaGapRow = memo(function AgendaGapRow({
  gap,
  label,
}: AgendaGapRowProps) {
  return (
    <View
      accessibilityRole="text"
      className="flex-row items-center gap-3 px-4 py-2"
    >
      <View className="min-w-16 items-end">
        <View
          className={cn(
            "h-4 w-0.5 rounded-full",
            gap.kind === "overlap" ? "bg-destructive" : "bg-border",
          )}
        />
      </View>
      <Text
        variant="caption"
        className={cn(
          "flex-1",
          gap.kind === "overlap" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </View>
  );
});
