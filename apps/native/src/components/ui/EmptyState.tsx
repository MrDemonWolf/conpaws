import { Host, Icon, type IconName, Button as NativeButton } from "@expo/ui";
import { useTheme } from "expo-router/react-navigation";
import { useColorScheme, View } from "react-native";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Text } from "./Text";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  compact?: boolean;
  ctaLabel?: string;
  onCta?: () => void;
  ctaTestID?: string;
  secondaryCtaLabel?: string;
  onSecondaryCta?: () => void;
  secondaryCtaTestID?: string;
  className?: string;
  testID?: string;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  compact = false,
  ctaLabel,
  onCta,
  ctaTestID,
  secondaryCtaLabel,
  onSecondaryCta,
  secondaryCtaTestID,
  className,
  testID,
}: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const { colors } = useTheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";

  return (
    <View
      className={cn(
        "flex-1 items-center justify-center px-6 gap-4",
        compact &&
          "mx-4 flex-none items-stretch justify-start rounded-3xl border border-border bg-card px-5 py-6",
        className,
      )}
      style={compact ? { borderCurve: "continuous" } : undefined}
      testID={testID}
    >
      {icon ? (
        <View
          accessibilityElementsHidden
          className={cn(compact && "self-start rounded-full bg-primary/10 p-3")}
          importantForAccessibility="no-hide-descendants"
        >
          <Host
            colorScheme={resolvedColorScheme}
            matchContents
            pointerEvents="none"
          >
            <Icon
              color={compact ? colors.primary : undefined}
              name={icon}
              size={compact ? 28 : 52}
            />
          </Host>
        </View>
      ) : null}
      <View
        className={cn(compact ? "items-start gap-1" : "items-center gap-2")}
      >
        <Text variant="h3" className={compact ? "text-left" : "text-center"}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="body"
            className={cn(
              "text-muted-foreground",
              compact ? "text-left" : "text-center",
            )}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        className={cn(
          compact ? "items-stretch gap-1 pt-1" : "items-center gap-1",
        )}
      >
        {ctaLabel && onCta ? (
          compact ? (
            <Button
              className="min-h-12 w-full"
              onPress={onCta}
              testID={ctaTestID}
            >
              {ctaLabel}
            </Button>
          ) : (
            <Host
              colorScheme={resolvedColorScheme}
              seedColor={colors.primary}
              matchContents
            >
              <NativeButton
                label={ctaLabel}
                onPress={onCta}
                style={{ height: 44 }}
                testID={ctaTestID}
              />
            </Host>
          )
        ) : null}
        {secondaryCtaLabel && onSecondaryCta ? (
          compact ? (
            <Button
              className="min-h-12 w-full"
              onPress={onSecondaryCta}
              testID={secondaryCtaTestID}
              variant="ghost"
            >
              {secondaryCtaLabel}
            </Button>
          ) : (
            <Host colorScheme={resolvedColorScheme} matchContents>
              <NativeButton
                label={secondaryCtaLabel}
                onPress={onSecondaryCta}
                variant="text"
                style={{ height: 44 }}
                testID={secondaryCtaTestID}
              />
            </Host>
          )
        ) : null}
      </View>
    </View>
  );
}
