import { View, Text } from "react-native";
import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "secondary" | "premium" | "verified";
  children: React.ReactNode;
  className?: string;
}

const badgeVariants = {
  default: "bg-blue-100 dark:bg-blue-900",
  secondary: "bg-gray-100 dark:bg-gray-800",
  premium: "bg-amber-100 dark:bg-amber-900",
  verified: "bg-green-100 dark:bg-green-900",
};

const textVariants = {
  default: "text-blue-700 dark:text-blue-300",
  secondary: "text-gray-700 dark:text-gray-300",
  premium: "text-amber-700 dark:text-amber-300",
  verified: "text-green-700 dark:text-green-300",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <View
      className={cn(
        "rounded-full px-2.5 py-0.5",
        badgeVariants[variant],
        className,
      )}
    >
      <Text className={cn("text-xs font-medium", textVariants[variant])}>
        {children}
      </Text>
    </View>
  );
}
