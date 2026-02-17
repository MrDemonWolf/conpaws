import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

interface OnboardingSlideProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function OnboardingSlide({
  icon,
  title,
  description,
  children,
  className,
}: OnboardingSlideProps) {
  return (
    <SafeAreaView className={cn("flex-1 bg-background", className)}>
      <View className="flex-1 items-center justify-center px-8">
        {icon && <View className="mb-8">{icon}</View>}
        <Text className="text-center text-3xl font-bold text-foreground">
          {title}
        </Text>
        {description && (
          <Text className="mt-4 text-center text-lg text-muted-foreground">
            {description}
          </Text>
        )}
      </View>
      {children && (
        <View className="px-8 pb-8">
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
