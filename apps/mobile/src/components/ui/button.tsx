import { Pressable, Text, type PressableProps } from "react-native";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
  textClassName?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-primary active:bg-primary/90",
  secondary: "bg-secondary active:bg-secondary/80",
  outline: "border border-input bg-transparent active:bg-accent",
  ghost: "active:bg-accent",
  destructive: "bg-destructive active:bg-destructive/90",
  link: "bg-transparent",
};

const variantTextStyles: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive-foreground",
  link: "text-primary underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-6 rounded-xl",
  sm: "h-9 px-4 rounded-lg",
  lg: "h-14 px-8 rounded-xl",
  icon: "h-10 w-10 rounded-lg",
};

const sizeTextStyles: Record<ButtonSize, string> = {
  default: "text-base",
  sm: "text-sm",
  lg: "text-lg",
  icon: "text-base",
};

export function Button({
  variant = "default",
  size = "default",
  children,
  className,
  textClassName,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-center",
        variantStyles[variant],
        sizeStyles[size],
        disabled && "opacity-50",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {typeof children === "string" ? (
        <Text
          className={cn(
            "font-semibold",
            variantTextStyles[variant],
            sizeTextStyles[size],
            textClassName,
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
