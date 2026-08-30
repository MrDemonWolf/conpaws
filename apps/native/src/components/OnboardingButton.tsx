import { Button } from "@/components/ui";
import type { OnboardingButtonProps } from "./OnboardingButton.types";

export function OnboardingButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  testID,
}: OnboardingButtonProps) {
  return (
    <Button
      onPress={onPress}
      variant={
        variant === "primary"
          ? "default"
          : variant === "text"
            ? "ghost"
            : "outline"
      }
      size="md"
      disabled={disabled}
      testID={testID}
      // No min-h override: Button already sets the 48dp floor that both
      // platform minimums need, and min-h-11 (44px) undercut it on Android.
      className="w-full"
    >
      {label}
    </Button>
  );
}
