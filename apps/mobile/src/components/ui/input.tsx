import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";

interface InputProps extends TextInputProps {
  className?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <TextInput
      className={cn(
        "h-12 rounded-xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground",
        className,
      )}
      placeholderTextColor="#78716c"
      {...props}
    />
  );
}
