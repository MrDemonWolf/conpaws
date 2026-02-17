import { Pressable, View, Text } from "react-native";
import { ChevronRight } from "@/lib/icons";
import { useColorScheme } from "@/lib/useColorScheme";
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
  const { isDark } = useColorScheme();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center border-b border-border px-4 py-3.5 last:border-b-0 active:bg-accent"
    >
      <Icon
        size={20}
        color={
          destructive
            ? "#ef4444"
            : isDark
              ? "#a8a29e"
              : "#78716c"
        }
      />
      <Text
        className={`ml-3 flex-1 text-base ${
          destructive ? "text-destructive" : "text-foreground"
        }`}
      >
        {label}
      </Text>
      {value && (
        <Text className="mr-1 text-sm text-muted-foreground">{value}</Text>
      )}
      {onPress && (
        <ChevronRight
          size={18}
          color={isDark ? "#44403c" : "#d6d3d1"}
        />
      )}
    </Pressable>
  );
}
