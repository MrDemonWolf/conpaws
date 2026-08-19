import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  step: 1 | 2 | 3;
}

export function OnboardingProgress({ step }: OnboardingProgressProps) {
  const { t } = useTranslation();
  const segmentClassName = "h-1 w-8 rounded-full";

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("onboarding.progress", { step, total: 3 })}
      accessibilityValue={{ min: 1, max: 3, now: step }}
      className="h-4 flex-row items-center justify-center gap-2"
    >
      <View className={cn(segmentClassName, "bg-primary")} />
      <View
        className={cn(segmentClassName, step >= 2 ? "bg-primary" : "bg-border")}
      />
      <View
        className={cn(segmentClassName, step >= 3 ? "bg-primary" : "bg-border")}
      />
    </View>
  );
}
