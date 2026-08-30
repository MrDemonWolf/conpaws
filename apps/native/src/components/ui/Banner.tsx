import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, useColorScheme, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { themeTokens } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";

import { PRESS_DIM, TAP_TARGET } from "./Row";

export type BannerTone = "secondary" | "info";

const toneStyles: Record<BannerTone, { surface: string; body: string }> = {
  secondary: { surface: "bg-secondary", body: "text-muted-foreground" },
  info: { surface: "bg-info", body: "text-info-foreground" },
};

interface BannerProps {
  tone?: BannerTone;
  /** Omit for a single-line banner; the layout centres itself when absent. */
  title?: string;
  body: string;
  /** Leading icon. Colour it with `useBannerIconColor`. */
  leading?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
  className?: string;
  testID?: string;
}

/**
 * Icon tint matching the banner's own text.
 *
 * Icons take colours as props, not classes, so a hex is unavoidable — the same
 * documented pattern as EventItem's content-warning triangle. Reading it from
 * `themeTokens` rather than retyping the pair keeps it inside the coverage
 * `theme-tokens.test.ts` provides; the info pair used to be typed by hand in
 * ScheduleHintCard and so escaped it.
 */
export function useBannerIconColor(tone: BannerTone = "secondary"): string {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return tone === "info"
    ? themeTokens[scheme].infoForeground
    : themeTokens[scheme].mutedForeground;
}

/**
 * A status strip: says what happened, optionally offers one action, optionally
 * dismisses.
 *
 * There were four of these, hand-built, and they disagreed on things a reader
 * notices. Two set `borderCurve: "continuous"` and two did not, while being
 * stacked in the same container. And only two carried
 * `accessibilityRole="alert"` — so half the app's status messages appeared
 * silently to VoiceOver, which is the whole job of a banner. Both are settled
 * here rather than per-site, so a fifth banner cannot get them wrong.
 */
export function Banner({
  tone = "secondary",
  title,
  body,
  leading,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  className,
  testID,
}: BannerProps) {
  const iconColor = useBannerIconColor(tone);
  const styles = toneStyles[tone];

  return (
    <View
      accessibilityRole="alert"
      testID={testID}
      className={cn(
        "mx-4 mb-2 flex-row gap-3 rounded-xl px-3 py-2.5",
        // A stacked title and body read from the top; a single line centres
        // against its icon and dismiss control.
        title ? "items-start" : "items-center",
        styles.surface,
        className,
      )}
      style={{ borderCurve: "continuous" }}
    >
      {leading}
      <View className="flex-1">
        {title ? <Text variant="label">{title}</Text> : null}
        <Text variant="caption" className={cn(title && "pt-0.5", styles.body)}>
          {body}
        </Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            className={cn(TAP_TARGET, "justify-center", PRESS_DIM)}
          >
            <Text className="text-primary">{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {dismissLabel && onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          // Dismissing hides this sentence, never the marks on the rows. The
          // record of what happened stays where the reader will look for it.
          hitSlop={12}
          className={PRESS_DIM}
        >
          <X size={17} color={iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
}
