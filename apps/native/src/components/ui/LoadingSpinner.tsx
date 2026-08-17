import { ActivityIndicator, View } from "react-native";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  className?: string;
}

export function LoadingSpinner({
  size = "large",
  className,
}: LoadingSpinnerProps) {
  return (
    <View className={cn("flex-1 items-center justify-center", className)}>
      <ActivityIndicator size={size} color="#0FACED" />
    </View>
  );
}
