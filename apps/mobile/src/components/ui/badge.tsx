import { View, Text } from "react-native";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "upcoming" | "active" | "ended";

interface BadgeProps {
  variant?: BadgeVariant;
  children: string;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-primary",
  secondary: "bg-secondary",
  outline: "border border-border bg-transparent",
  destructive: "bg-destructive",
  upcoming: "bg-blue-500",
  active: "bg-green-500",
  ended: "bg-muted",
};

const variantTextStyles: Record<BadgeVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  destructive: "text-destructive-foreground",
  upcoming: "text-white",
  active: "text-white",
  ended: "text-muted-foreground",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <View
      className={cn(
        "self-start rounded-full px-2.5 py-0.5",
        variantStyles[variant],
        className,
      )}
    >
      <Text
        className={cn("text-xs font-medium", variantTextStyles[variant])}
      >
        {children}
      </Text>
    </View>
  );
}
