import { Pressable, Text } from "react-native";
import { ChevronRight } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { LucideIcon } from "lucide-react-native";

interface SettingsItemProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}

export function SettingsItem({
  icon: Icon,
  label,
  value,
  onPress,
  destructive,
}: SettingsItemProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center border-b border-border px-4 py-3.5 last:border-b-0 active:bg-accent"
    >
      <Icon
        size={20}
        color={destructive ? colors.destructive : colors.mutedForeground}
      />
      <Text
        className={cn(
          "ml-3 flex-1 text-base",
          destructive ? "text-destructive" : "text-foreground",
        )}
      >
        {label}
      </Text>
      {value && (
        <Text className="mr-1 text-sm text-muted-foreground">{value}</Text>
      )}
      {onPress && (
        <ChevronRight size={18} color={colors.border} />
      )}
    </Pressable>
  );
}
