import { View } from "react-native";
import { Text } from "@/components/ui";
import { cn } from "@/lib/utils";

interface OnboardingSlideProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function OnboardingSlide({
  icon,
  title,
  description,
  className,
}: OnboardingSlideProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${description}`}
      className={cn(
        "flex-row items-start gap-4 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10"
      >
        {icon}
      </View>
      <View className="flex-1 gap-1">
        <Text variant="body" className="font-semibold">
          {title}
        </Text>
        <Text variant="caption" className="leading-5 text-muted-foreground">
          {description}
        </Text>
      </View>
    </View>
  );
}
