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
import { View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { themeTokens } from "@/lib/theme-tokens";
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
  const resolvedColorScheme = useResolvedColorScheme();
  const NativeButton = buttonComponents[variant];
  const modifiers = [
    fillMaxWidth(),
    // Material 3 asks for 48dp; 44 is the iOS figure and too small here.
    defaultMinSize({ minHeight: 48 }),
    ...(testID ? [testIDModifier(testID)] : []),
  ];

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
