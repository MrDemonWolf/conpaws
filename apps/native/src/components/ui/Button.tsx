import { ActivityIndicator, Pressable, useColorScheme } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-primary",
  secondary: "bg-secondary",
  outline: "border border-border bg-transparent",
  ghost: "bg-transparent",
  destructive: "bg-destructive",
};

const textVariantStyles: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive-foreground",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 rounded-lg",
  md: "px-4 py-2.5 rounded-xl",
  lg: "px-6 py-3.5 rounded-xl",
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  onPress,
  children,
  variant = "default",
  size = "md",
  disabled = false,
  loading = false,
  className,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const colorScheme = useColorScheme();
  const spinnerColor =
    variant === "default" || variant === "destructive"
      ? colorScheme === "dark"
        ? "#091533"
        : "#FFFFFF"
      : colorScheme === "dark"
        ? "#18B7F2"
        : "#006F91";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        (typeof children === "string" ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      className={cn(
        "min-h-[44px] flex-row items-center justify-center",
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && "opacity-50",
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : typeof children === "string" ? (
        <Text
          className={cn(
            "font-semibold",
            textVariantStyles[variant],
            textSizeStyles[size],
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
