import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";

export const Input = forwardRef<TextInput, TextInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          "h-12 rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
          className,
        )}
        placeholderTextColor="#9ca3af"
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
