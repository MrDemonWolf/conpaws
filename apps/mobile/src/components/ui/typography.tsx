import { Text, type TextProps } from "react-native";
import { cn } from "@/lib/utils";

type TypographyProps = TextProps;

export function H1({ className, ...props }: TypographyProps) {
  return (
    <Text
      className={cn("text-4xl font-bold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function H2({ className, ...props }: TypographyProps) {
  return (
    <Text
      className={cn("text-2xl font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
}

export function H3({ className, ...props }: TypographyProps) {
  return (
    <Text
      className={cn("text-xl font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function Body({ className, ...props }: TypographyProps) {
  return (
    <Text
      className={cn("text-base text-foreground", className)}
      {...props}
    />
  );
}

export function Caption({ className, ...props }: TypographyProps) {
  return (
    <Text
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function Muted({ className, ...props }: TypographyProps) {
  return (
    <Text
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
