import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";

interface OnboardingSlideProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function OnboardingSlide({
  icon,
  title,
  description,
  action,
  className,
}: OnboardingSlideProps) {
  return (
    <View className={cn("items-center gap-4 px-6", className)}>
      <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center">
        {icon}
      </View>
      <View className="items-center gap-2">
        <Text variant="h3" className="text-center">
          {title}
        </Text>
        <Text variant="caption" className="text-center leading-5">
          {description}
        </Text>
      </View>
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
