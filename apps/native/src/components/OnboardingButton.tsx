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
      className="min-h-11 w-full"
    >
      {label}
    </Button>
  );
}
