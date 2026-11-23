import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  /** The current step, counted from 1. */
  step: number;
  /**
   * How many steps the flow has. Onboarding has three; the how-to
   * walkthroughs in Settings > Getting started have three or four.
   */
  total?: number;
}

export function OnboardingProgress({
  step,
  total = 3,
}: OnboardingProgressProps) {
  const { t } = useTranslation();
  const segments = Array.from({ length: total }, (_, index) => index + 1);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("onboarding.progress", { step, total })}
      // Use a zero-based range so native percentage output stays within 100%.
      accessibilityValue={{ min: 0, max: total, now: step }}
      className="h-4 flex-row items-center justify-center gap-2"
    >
      {segments.map((segment) => (
        <View
          key={segment}
          className={cn(
            "h-1 w-8 rounded-full",
            segment <= step ? "bg-primary" : "bg-border",
          )}
        />
      ))}
    </View>
  );
}
