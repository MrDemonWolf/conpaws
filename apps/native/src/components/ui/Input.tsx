import { TextInput, type TextInputProps, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

/**
 * Placeholder colour cannot be a theme class: `placeholderTextColor` is a prop,
 * so NativeWind never sees it and the token never reaches the field. These two
 * greys are the per-theme values that clear WCAG AA against both `background`
 * and `card`. They are not interchangeable -- the dark value lands near 2.3:1
 * on a light card, which is why every call site must ask for the pair rather
 * than paste one of them.
 */
const PLACEHOLDER_COLOR = { dark: "#94A3B8", light: "#64748B" } as const;

export function usePlaceholderTextColor(): string {
  return PLACEHOLDER_COLOR[useResolvedColorScheme()];
}

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
  accessibilityHint,
  placeholderTextColor,
  ...props
}: InputProps) {
  const placeholderColor = usePlaceholderTextColor();

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
        // The error message is a sibling node, and React Native has no
        // equivalent of aria-describedby to tie the two together. Carrying it
        // in the hint is what makes a screen reader state the problem when
        // focus lands on the field, instead of only if it later reaches the
        // message on its own.
        accessibilityHint={
          [accessibilityHint, error].filter(Boolean).join(". ") || undefined
        }
        placeholderTextColor={placeholderTextColor ?? placeholderColor}
        {...props}
      />
      {error ? (
        <Text
          variant="caption"
          className="text-destructive"
          // accessibilityLiveRegion is Android-only; the alert role is what
          // makes VoiceOver announce the message when it appears.
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
