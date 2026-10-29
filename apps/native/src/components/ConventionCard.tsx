import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import { Host, Icon } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { Pressable, View } from "react-native";
import { PRESS_DIM, Text } from "@/components/ui";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import type {
  ConventionRowAction,
  ConventionRowActionId,
} from "@/lib/convention-row-actions";
import { cn } from "@/lib/utils";
import { ConventionRowMenu } from "./ConventionRowMenu";

interface ConventionCardProps {
  name: string;
  dateRange: string;
  status: "upcoming" | "active" | "ended";
  statusLabel: string;
  onPress?: () => void;
  actions?: readonly ConventionRowAction[];
  onAction?: (action: ConventionRowActionId) => void;
  moreAccessibilityLabel?: string;
  className?: string;
}

const CHEVRON_ICON = Icon.select({
  ios: "chevron.right",
  android: ChevronRightIcon,
});

const statusStyles: Record<ConventionCardProps["status"], string> = {
  upcoming: "text-foreground",
  active: "text-primary",
  ended: "text-muted-foreground",
};

const statusContainerStyles: Record<ConventionCardProps["status"], string> = {
  upcoming: "bg-secondary",
  active: "bg-primary/10",
  ended: "bg-muted",
};

export function ConventionCard({
  name,
  dateRange,
  status,
  statusLabel,
  onPress,
  actions,
  onAction,
  moreAccessibilityLabel,
  className,
}: ConventionCardProps) {
  const colorScheme = useResolvedColorScheme();
  const { colors } = useTheme();

  return (
    <View className={cn("min-h-16 flex-row items-stretch", className)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${dateRange}, ${statusLabel}`}
        onPress={onPress}
        className={cn(
          "flex-1 flex-row items-center gap-3 px-1 py-3",
          PRESS_DIM,
        )}
      >
        <View className="flex-1 gap-1">
          <Text variant="body" className="font-semibold">
            {name}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text variant="caption">{dateRange}</Text>
            <View
              className={cn(
                "rounded-full px-2 py-0.5",
                statusContainerStyles[status],
              )}
              style={{ borderCurve: "continuous" }}
            >
              <Text variant="caption" className={statusStyles[status]}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>
        {!onAction ? (
          <Host colorScheme={colorScheme} matchContents pointerEvents="none">
            <Icon name={CHEVRON_ICON} size={14} color={colors.text} />
          </Host>
        ) : null}
      </Pressable>
      {onAction && actions && moreAccessibilityLabel ? (
        <ConventionRowMenu
          actions={actions}
          accessibilityLabel={moreAccessibilityLabel}
          onAction={onAction}
        />
      ) : null}
    </View>
  );
}
