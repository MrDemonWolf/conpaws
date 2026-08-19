import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
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

export function ConventionCard({
  name,
  dateRange,
  status,
  statusLabel,
  onPress,
  className,
}: ConventionCardProps) {
  const colorScheme = useColorScheme();
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${dateRange}, ${statusLabel}`}
      onPress={onPress}
      className={cn(
        "min-h-16 flex-row items-center gap-3 px-1 py-3 active:opacity-60",
        className,
      )}
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
      <Host
        colorScheme={colorScheme === "dark" ? "dark" : "light"}
        matchContents
        pointerEvents="none"
      >
        <Icon name={CHEVRON_ICON} size={14} color={colors.text} />
      </Host>
    </Pressable>
  );
}
