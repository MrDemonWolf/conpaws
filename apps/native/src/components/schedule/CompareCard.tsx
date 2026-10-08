import { Check, Clock, MapPin } from "lucide-react-native";
import { Pressable, useColorScheme, View } from "react-native";
import { Badge, PRESS_DIM, Text } from "@/components/ui";
import { themeTokens } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";

export interface CompareCardProps {
  title: string;
  category?: string;
  accentColor?: string | null;
  timeRange: string;
  room?: string;
  summary?: string;
  inPlan: boolean;
  inPlanLabel: string;
  selected: boolean;
  /** "25 min overlaps your current choice" */
  overlapNote?: string;
  accessibilityLabel: string;
  onSelect: () => void;
}

/** One option on the compare sheet, behaving as a radio button. */
export function CompareCard({
  title,
  category,
  accentColor,
  timeRange,
  room,
  summary,
  inPlan,
  inPlanLabel,
  selected,
  overlapNote,
  accessibilityLabel,
  onSelect,
}: CompareCardProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const tokens = themeTokens[scheme];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onSelect}
      className={cn(
        "mx-4 gap-2 rounded-2xl border-2 bg-card p-4",
        selected ? "border-primary" : "border-transparent",
        PRESS_DIM,
      )}
      style={{ borderCurve: "continuous" }}
    >
      <View className="flex-row items-center gap-2">
        {category ? (
          <Text
            variant="caption"
            className="flex-1 font-semibold uppercase tracking-wide"
            style={accentColor ? { color: accentColor } : undefined}
            numberOfLines={1}
          >
            {category}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {inPlan ? <Badge variant="active" label={inPlanLabel} /> : null}
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className={cn(
            "h-6 w-6 items-center justify-center rounded-full border-2",
            selected ? "border-primary bg-primary" : "border-border",
          )}
        >
          {selected ? (
            <Check size={14} color={tokens.primaryForeground} strokeWidth={3} />
          ) : null}
        </View>
      </View>
      <Text variant="h3" accessibilityRole="none">
        {title}
      </Text>
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          <Clock size={14} color={tokens.mutedForeground} />
          <Text variant="caption">{timeRange}</Text>
        </View>
        {room ? (
          <View className="flex-row items-center gap-1.5">
            <MapPin size={14} color={tokens.mutedForeground} />
            <Text variant="caption">{room}</Text>
          </View>
        ) : null}
      </View>
      {summary ? (
        <Text variant="caption" className="text-foreground" numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
      {overlapNote ? (
        <Text variant="caption" className="text-destructive">
          {overlapNote}
        </Text>
      ) : null}
    </Pressable>
  );
}
