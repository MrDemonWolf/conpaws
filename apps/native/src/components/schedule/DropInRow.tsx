import { ChevronRight, Store } from "lucide-react-native";
import { memo } from "react";
import { useColorScheme, View } from "react-native";
import { Row, Text } from "@/components/ui";
import { themeTokens } from "@/lib/theme-tokens";

interface DropInRowProps {
  title: string;
  /** "Saturday · 10 AM–6 PM · Exhibit Hall" */
  summary: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
  testID?: string;
}

/** All-day programming under "Drop in anytime": a room, not a timed commitment. */
export const DropInRow = memo(function DropInRow({
  title,
  summary,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  testID,
}: DropInRowProps) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const tokens = themeTokens[scheme];

  return (
    <Row
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      className="border-border border-b px-4 py-3"
      trailing={<ChevronRight size={18} color={tokens.mutedForeground} />}
    >
      <View className="flex-row items-center gap-3">
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="h-10 w-10 items-center justify-center rounded-xl bg-info"
          style={{ borderCurve: "continuous" }}
        >
          <Store size={20} color={tokens.infoForeground} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="label" className="font-semibold">
            {title}
          </Text>
          <Text variant="caption" numberOfLines={2}>
            {summary}
          </Text>
        </View>
      </View>
    </Row>
  );
});
