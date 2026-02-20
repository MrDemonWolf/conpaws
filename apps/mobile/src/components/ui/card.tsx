import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        "rounded-2xl border border-border bg-card p-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn("pb-3", className)} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn("", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn("flex-row items-center pt-3", className)}
      {...props}
    />
  );
}
