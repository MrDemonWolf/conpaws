import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/hooks/use-theme-colors";

interface InputProps extends TextInputProps {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  const colors = useThemeColors();

  return (
    <TextInput
      className={cn(
        "h-12 rounded-xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground",
        className,
      )}
      placeholderTextColor={colors.mutedForeground}
      {...props}
    />
  );
}
