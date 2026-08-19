import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/lib/utils";

type TextVariant = "h1" | "h2" | "h3" | "body" | "caption" | "label";

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
}

const variantStyles: Record<TextVariant, string> = {
  h1: "text-3xl font-bold text-foreground",
  h2: "text-2xl font-bold text-foreground",
  h3: "text-xl font-semibold text-foreground",
  body: "text-base text-foreground",
  caption: "text-sm text-muted-foreground",
  label: "text-sm font-medium text-foreground",
};

const dynamicTypeRamps: Record<
  TextVariant,
  NonNullable<RNTextProps["dynamicTypeRamp"]>
> = {
  h1: "largeTitle",
  h2: "title1",
  h3: "title2",
  body: "body",
  caption: "footnote",
  label: "subheadline",
};

export function Text({
  variant = "body",
  className,
  children,
  dynamicTypeRamp,
  accessibilityRole,
  ...props
}: TextProps) {
  return (
    <RNText
      className={cn(variantStyles[variant], className)}
      dynamicTypeRamp={dynamicTypeRamp ?? dynamicTypeRamps[variant]}
      accessibilityRole={
        accessibilityRole ?? (variant.startsWith("h") ? "header" : undefined)
      }
      {...props}
    >
      {children}
    </RNText>
  );
}
