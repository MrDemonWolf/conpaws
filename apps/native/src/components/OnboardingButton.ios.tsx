import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
} from "@expo/ui/swift-ui/modifiers";
import { useColorScheme, View } from "react-native";
import type { OnboardingButtonProps } from "./OnboardingButton.types";

const buttonStyles = {
  primary: "borderedProminent",
  secondary: "bordered",
  text: "borderless",
} as const;

export function OnboardingButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  testID,
}: OnboardingButtonProps) {
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";

  return (
    <View className="w-full">
      <Host
        colorScheme={resolvedColorScheme}
        seedColor={
          variant === "primary"
            ? "#006F91"
            : resolvedColorScheme === "dark"
              ? "#18B7F2"
              : "#006F91"
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
            disabledModifier(disabled),
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
