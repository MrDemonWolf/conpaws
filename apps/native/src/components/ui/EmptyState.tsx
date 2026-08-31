import { Host, Icon, type IconName, Button as NativeButton } from "@expo/ui";
import { frame } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "expo-router/react-navigation";
import { Platform, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
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
  actionsInline?: boolean;
  secondaryCtaVariant?: "text" | "outlined";
  className?: string;
  testID?: string;
}

/**
 * The tap-target floor for the SwiftUI buttons, expressed as a minimum rather
 * than a fixed height. The universal `style` prop cannot say this -- it maps
 * only `width`/`height` onto SwiftUI's `frame`, and a fixed frame pins the
 * label inside 44pt at Larger Accessibility Sizes while every other control
 * grows -- so the modifier escape hatch is the only way to express a floor.
 * iOS-only by construction: both call sites sit behind `Platform.OS === "ios"`.
 */
const IOS_MIN_TAP_TARGET = [frame({ minHeight: 44 })];

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
  actionsInline = false,
  secondaryCtaVariant = "text",
  className,
  testID,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();

  return (
    <View
      className={cn(
        "flex-1 items-center justify-center px-6 gap-4",
        compact && "mx-4 flex-none items-stretch justify-start px-5 py-6",
        className,
      )}
      testID={testID}
    >
      {icon ? (
        <View
          accessibilityElementsHidden
          className={cn(compact && "self-start")}
          importantForAccessibility="no-hide-descendants"
        >
          <Host
            colorScheme={resolvedColorScheme}
            matchContents
            pointerEvents="none"
            // Android collapses a matchContents Host to zero height, which
            // let the icon paint straight through the title beneath it. An
            // explicit box is the only thing that reserves the space.
            style={{ width: compact ? 28 : 52, height: compact ? 28 : 52 }}
          >
            <Icon
              // An untinted Compose Icon paints black, so the large empty-state
              // icon was invisible on Android in dark mode -- the "No
              // conventions yet" screen simply had no icon. SwiftUI resolves
              // the unset case against the appearance, so iOS keeps it.
              color={
                compact
                  ? colors.primary
                  : Platform.OS === "android"
                    ? colors.text
                    : undefined
              }
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
          actionsInline && "flex-row flex-wrap justify-center gap-2",
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
          ) : Platform.OS === "ios" ? (
            <Host
              colorScheme={resolvedColorScheme}
              seedColor={colors.primary}
              matchContents
            >
              <NativeButton
                label={ctaLabel}
                modifiers={IOS_MIN_TAP_TARGET}
                onPress={onCta}
                testID={ctaTestID}
              />
            </Host>
          ) : (
            // Android measures a matchContents Host at the full available
            // width, so the native button lands against the right edge and
            // the parent's items-center has nothing to centre. alignSelf on
            // the Host does not override it. The plain button sizes to its
            // own content, which is what centring needs.
            <Button
              className="min-h-12 self-center px-6"
              onPress={onCta}
              testID={ctaTestID}
            >
              {ctaLabel}
            </Button>
          )
        ) : null}
        {secondaryCtaLabel && onSecondaryCta ? (
          compact ? (
            <Button
              className="min-h-12 w-full"
              onPress={onSecondaryCta}
              testID={secondaryCtaTestID}
              variant={secondaryCtaVariant === "outlined" ? "outline" : "ghost"}
            >
              {secondaryCtaLabel}
            </Button>
          ) : Platform.OS === "ios" ? (
            <Host colorScheme={resolvedColorScheme} matchContents>
              <NativeButton
                label={secondaryCtaLabel}
                modifiers={IOS_MIN_TAP_TARGET}
                onPress={onSecondaryCta}
                variant={secondaryCtaVariant}
                testID={secondaryCtaTestID}
              />
            </Host>
          ) : (
            <Button
              className="min-h-12 self-center px-6"
              onPress={onSecondaryCta}
              testID={secondaryCtaTestID}
              // Honor the requested variant — hardcoding ghost made the
              // secondary action visually weaker on Android than on iOS.
              variant={secondaryCtaVariant === "outlined" ? "outline" : "ghost"}
            >
              {secondaryCtaLabel}
            </Button>
          )
        ) : null}
      </View>
    </View>
  );
}
