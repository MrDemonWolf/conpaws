import { Image, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps {
  uri?: string;
  initials?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<
  AvatarSize,
  { container: string; text: string; px: number }
> = {
  sm: {
    container: "w-8 h-8 rounded-full",
    text: "text-xs font-semibold",
    px: 32,
  },
  md: {
    container: "w-12 h-12 rounded-full",
    text: "text-sm font-semibold",
    px: 48,
  },
  lg: {
    container: "w-20 h-20 rounded-full",
    text: "text-xl font-semibold",
    px: 80,
  },
};

export function Avatar({ uri, initials, size = "md", className }: AvatarProps) {
  const styles = sizeStyles[size];
  return (
    <View
      className={cn(
        styles.container,
        "bg-primary items-center justify-center overflow-hidden",
        className,
      )}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: styles.px, height: styles.px }}
        />
      ) : (
        <Text className={cn(styles.text, "text-primary-foreground")}>
          {initials ?? "?"}
        </Text>
      )}
    </View>
  );
}
