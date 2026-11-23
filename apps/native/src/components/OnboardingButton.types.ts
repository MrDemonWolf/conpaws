export interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "text";
  testID?: string;
}
