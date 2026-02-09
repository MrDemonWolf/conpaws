import { forwardRef } from "react";
import { Pressable, Text, type PressableProps } from "react-native";
import { cn } from "@/lib/utils";

interface ButtonProps extends PressableProps {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  children: React.ReactNode;
}

const buttonVariants = {
  default: "bg-blue-500 active:bg-blue-600",
  secondary: "bg-gray-200 dark:bg-gray-800 active:bg-gray-300 dark:active:bg-gray-700",
  outline: "border border-gray-300 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800",
  ghost: "active:bg-gray-100 dark:active:bg-gray-800",
  destructive: "bg-red-500 active:bg-red-600",
};

const buttonSizes = {
  default: "h-12 px-6 py-3",
  sm: "h-9 px-4 py-2",
  lg: "h-14 px-8 py-4",
  icon: "h-10 w-10",
};

const textVariants = {
  default: "text-white font-semibold",
  secondary: "text-gray-900 dark:text-gray-100 font-semibold",
  outline: "text-gray-900 dark:text-gray-100 font-semibold",
  ghost: "text-gray-900 dark:text-gray-100 font-semibold",
  destructive: "text-white font-semibold",
};

const textSizes = {
  default: "text-base",
  sm: "text-sm",
  lg: "text-lg",
  icon: "text-base",
};

export const Button = forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  ({ variant = "default", size = "default", className, children, disabled, ...props }, ref) => {
    return (
      <Pressable
        ref={ref}
        className={cn(
          "flex-row items-center justify-center rounded-xl",
          buttonVariants[variant],
          buttonSizes[size],
          disabled && "opacity-50",
          className,
        )}
        disabled={disabled}
        {...props}
      >
        {typeof children === "string" ? (
          <Text className={cn(textVariants[variant], textSizes[size])}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);

Button.displayName = "Button";
