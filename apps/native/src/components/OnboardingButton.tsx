import { Button } from "@/components/ui";
import type { OnboardingButtonProps } from "./OnboardingButton.types";

export function OnboardingButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
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
      className="min-h-11 w-full"
    >
      {label}
    </Button>
  );
}
