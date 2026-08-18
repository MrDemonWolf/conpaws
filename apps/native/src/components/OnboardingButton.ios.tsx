import { Button, Host, Text } from "@expo/ui/swift-ui";
import {
  buttonBorderShape,
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
        seedColor={resolvedColorScheme === "dark" ? "#18B7F2" : "#006F91"}
        matchContents={{ vertical: true }}
        style={{ alignSelf: "stretch" }}
      >
        <Button
          onPress={onPress}
          testID={testID}
          modifiers={[
            buttonStyle(buttonStyles[variant]),
            controlSize("large"),
            buttonBorderShape("roundedRectangle", 12),
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
