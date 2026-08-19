import {
  Button,
  Host,
  OutlinedButton,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  defaultMinSize,
  fillMaxWidth,
  testID as testIDModifier,
} from "@expo/ui/jetpack-compose/modifiers";
import { useColorScheme, View } from "react-native";
import type { OnboardingButtonProps } from "./OnboardingButton.types";

const buttonComponents = {
  primary: Button,
  secondary: OutlinedButton,
  text: TextButton,
};

export function OnboardingButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  testID,
}: OnboardingButtonProps) {
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";
  const NativeButton = buttonComponents[variant];
  const modifiers = [
    fillMaxWidth(),
    defaultMinSize({ minHeight: 44 }),
    ...(testID ? [testIDModifier(testID)] : []),
  ];

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
        <NativeButton
          onClick={onPress}
          enabled={!disabled}
          modifiers={modifiers}
        >
          <Text style={{ typography: "labelLarge" }}>{label}</Text>
        </NativeButton>
      </Host>
    </View>
  );
}
