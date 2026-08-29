import { ActivityIndicator, Pressable, useColorScheme } from "react-native";
import { themeTokens } from "@/lib/theme-tokens";
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
  // Spinner colors come from the theme-token mirror (asserted against
  // global.css by theme-tokens.test.ts) — the old hardcoded hexes matched no
  // token and drifted from the palette unnoticed because nothing rendered
  // them: the loading prop had zero call sites until the create/edit/manual
  // save buttons were wired to it.
  const tokens = themeTokens[colorScheme === "dark" ? "dark" : "light"];
  const spinnerColor =
    variant === "default"
      ? tokens.primaryForeground
      : variant === "destructive"
        ? tokens.destructiveForeground
        : tokens.primary;

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
        // 48 satisfies both minimums: HIG asks 44pt, Material 3 asks 48dp.
        // active: gives every button the iOS press-dim; raw Pressables across
        // the app use the same modifier, so pressed feedback stays uniform.
        "min-h-[48px] flex-row items-center justify-center active:opacity-60",
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
