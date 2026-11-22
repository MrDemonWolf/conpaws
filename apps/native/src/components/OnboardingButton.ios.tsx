import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";
import type { OnboardingButtonProps } from "./OnboardingButton.types";

const buttonStyles = {
  primary: "borderedProminent",
  text: "borderless",
} as const;

export function OnboardingButton({
  label,
  onPress,
  variant = "primary",
  testID,
}: OnboardingButtonProps) {
  const resolvedColorScheme = useResolvedColorScheme();

  return (
    <View className="w-full">
      <Host
        colorScheme={resolvedColorScheme}
        seedColor={
          variant === "primary"
            ? themeTokens.light.primary
            : themeTokens[resolvedColorScheme].primary
        }
        matchContents={{ vertical: true }}
        style={{ alignSelf: "stretch" }}
      >
        <Button
          onPress={onPress}
          testID={testID}
          modifiers={[
            accessibilityLabel(label),
            buttonStyle(buttonStyles[variant]),
            controlSize("regular"),
          ]}
        >
          <Text modifiers={[frame({ maxWidth: Infinity, minHeight: 44 })]}>
            {label}
          </Text>
        </Button>
      </Host>
    </View>
  );
}
