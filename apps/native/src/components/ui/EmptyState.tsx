import { Host, Icon, type IconName, Button as NativeButton } from "@expo/ui";
import { useColorScheme, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./Text";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
  secondaryCtaLabel,
  onSecondaryCta,
  className,
}: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";

  return (
    <View
      className={cn("flex-1 items-center justify-center px-6 gap-4", className)}
    >
      {icon ? (
        <Host
          colorScheme={resolvedColorScheme}
          matchContents
          pointerEvents="none"
        >
          <Icon name={icon} size={52} />
        </Host>
      ) : null}
      <View className="items-center gap-2">
        <Text variant="h3" className="text-center">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" className="text-center text-muted-foreground">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="items-center gap-1">
        {ctaLabel && onCta ? (
          <Host
            colorScheme={resolvedColorScheme}
            seedColor="#006F91"
            matchContents
          >
            <NativeButton
              label={ctaLabel}
              onPress={onCta}
              style={{ height: 44 }}
            />
          </Host>
        ) : null}
        {secondaryCtaLabel && onSecondaryCta ? (
          <Host colorScheme={resolvedColorScheme} matchContents>
            <NativeButton
              label={secondaryCtaLabel}
              onPress={onSecondaryCta}
              variant="text"
              style={{ height: 44 }}
            />
          </Host>
        ) : null}
      </View>
    </View>
  );
}
