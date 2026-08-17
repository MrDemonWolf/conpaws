import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

type BadgeVariant = "upcoming" | "active" | "ended";

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { container: string; text: string }> =
  {
    upcoming: {
      container: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
    },
    active: {
      container: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-300",
    },
    ended: {
      container: "bg-muted",
      text: "text-muted-foreground",
    },
  };

export function Badge({ variant, label, className }: BadgeProps) {
  const styles = variantStyles[variant];
  return (
    <View
      className={cn("px-2.5 py-0.5 rounded-full", styles.container, className)}
    >
      <Text className={cn("text-xs font-medium", styles.text)}>{label}</Text>
    </View>
  );
}
