export interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  disabled?: boolean;
  testID?: string;
}
