import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import MoreVertIcon from "@expo/material-symbols/more_vert.xml";
import { Host, Icon } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { Pressable, useColorScheme, View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ConventionCardProps {
  name: string;
  dateRange: string;
  status: "upcoming" | "active" | "ended";
  statusLabel: string;
  onPress?: () => void;
  onMorePress?: () => void;
  moreAccessibilityLabel?: string;
  className?: string;
}

const CHEVRON_ICON = Icon.select({
  ios: "chevron.right",
  android: ChevronRightIcon,
});

const MORE_ICON = Icon.select({
  ios: "ellipsis",
  android: MoreVertIcon,
});

const statusStyles: Record<ConventionCardProps["status"], string> = {
  upcoming: "text-foreground",
  active: "text-primary",
  ended: "text-muted-foreground",
};

export function ConventionCard({
  name,
  dateRange,
  status,
  statusLabel,
  onPress,
  onMorePress,
  moreAccessibilityLabel,
  className,
}: ConventionCardProps) {
  const colorScheme = useColorScheme();
  const { colors } = useTheme();

  return (
    <View className={cn("min-h-16 flex-row items-stretch", className)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${dateRange}, ${statusLabel}`}
        onPress={onPress}
        className="flex-1 flex-row items-center gap-3 px-1 py-3 active:opacity-60"
      >
        <View className="flex-1 gap-1">
          <Text variant="body" className="font-semibold">
            {name}
          </Text>
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text variant="caption">{dateRange}</Text>
            <Text variant="caption" className={statusStyles[status]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        {!onMorePress ? (
          <Host
            colorScheme={colorScheme === "dark" ? "dark" : "light"}
            matchContents
            pointerEvents="none"
          >
            <Icon name={CHEVRON_ICON} size={14} color={colors.text} />
          </Host>
        ) : null}
      </Pressable>
      {onMorePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={moreAccessibilityLabel}
          hitSlop={4}
          onPress={onMorePress}
          className="w-11 items-center justify-center active:opacity-60"
        >
          <Host
            colorScheme={colorScheme === "dark" ? "dark" : "light"}
            matchContents
            pointerEvents="none"
          >
            <Icon name={MORE_ICON} size={22} color={colors.text} />
          </Host>
        </Pressable>
      ) : null}
    </View>
  );
}
