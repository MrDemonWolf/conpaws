import {
  TextInput,
  type TextInputProps,
  useColorScheme,
  View,
} from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({
  label,
  error,
  className,
  accessibilityLabel,
  placeholderTextColor,
  ...props
}: InputProps) {
  const colorScheme = useColorScheme();

  return (
    <View className="gap-1.5">
      {label ? (
        <Text variant="label" className="text-foreground" accessible={false}>
          {label}
        </Text>
      ) : null}
      <TextInput
        className={cn(
          "border rounded-xl px-3 py-2.5 text-foreground bg-background",
          error ? "border-destructive" : "border-input",
          className,
        )}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={
          placeholderTextColor ??
          (colorScheme === "dark" ? "#94A3B8" : "#64748B")
        }
        {...props}
      />
      {error ? (
        <Text
          variant="caption"
          className="text-destructive"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
