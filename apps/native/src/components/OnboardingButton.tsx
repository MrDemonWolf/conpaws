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
      size="lg"
      disabled={disabled}
      className="w-full"
    >
      {label}
    </Button>
  );
}
