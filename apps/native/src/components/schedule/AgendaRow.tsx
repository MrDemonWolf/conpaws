import { memo } from "react";
import { Pressable, useWindowDimensions, View } from "react-native";
import { Badge, type BadgeVariant, PRESS_DIM, Text } from "@/components/ui";
import type { AgendaStatus } from "@/lib/agenda-gaps";
import { cn } from "@/lib/utils";

export interface AgendaRowProps {
  title: string;
  /** "2:00" */
  startClock: string;
  /** "PM", absent in 24-hour locales. */
  dayPeriod?: string;
  /** "Until 3:00 PM" */
  untilLabel?: string;
  room?: string;
  /** Shown on the pooled Schedule tab when more than one convention is saved. */
  contextLabel?: string;
  accentColor?: string | null;
  status: AgendaStatus;
  /** Spoken and shown for `now` and the two ended states. */
  statusLabel?: string;
  /** True when this row genuinely clashes with another saved event. */
  hasConflict?: boolean;
  /** Printed (and spoken) only when `hasConflict` is true. */
  conflictLabel?: string;
  feedStatusLabel?: string;
  reminderLabel?: string;
  ageBadge?: { variant: BadgeVariant; label: string };
  contentWarningLabel?: string;
  accessibilityHint?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  testID?: string;
  className?: string;
}

/**
 * One saved event on an agenda: a time column, the title, where and until
 * when, and only the badges that change a plan (now, ended, cancelled,
 * overlapping). Everything on this list is saved, so no star.
 *
 * Stacks the time above the title at the accessibility sizes, for the same
 * reason `EventItem` does: the time column would otherwise squeeze the title
 * to a few letters.
 */
export const AgendaRow = memo(function AgendaRow({
  title,
  startClock,
  dayPeriod,
  untilLabel,
  room,
  contextLabel,
  accentColor,
  status,
  statusLabel,
  hasConflict = false,
  conflictLabel: conflictLabelProp,
  feedStatusLabel,
  reminderLabel,
  ageBadge,
  contentWarningLabel,
  accessibilityHint,
  onPress,
  onLongPress,
  testID,
  className,
}: AgendaRowProps) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.6;
  const ended = status === "ended" || status === "endedToday";
  const conflictLabel = hasConflict ? conflictLabelProp : undefined;
  const meta = [contextLabel, room, untilLabel].filter(Boolean).join(" · ");

  const accessibilityLabel = [
    feedStatusLabel,
    title,
    dayPeriod ? `${startClock} ${dayPeriod}` : startClock,
    untilLabel,
    ageBadge?.label,
    room,
    contextLabel,
    statusLabel,
    reminderLabel,
    conflictLabel,
    contentWarningLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      className={cn(
        "min-h-14 gap-3 border-border border-b px-4 py-3",
        stacked ? "flex-col" : "flex-row",
        ended && "opacity-60",
        PRESS_DIM,
        className,
      )}
    >
      <View
        className={cn(
          "shrink-0",
          stacked ? "flex-row items-baseline gap-1" : "min-w-16 items-end",
        )}
      >
        <Text variant="label" className="tabular-nums text-primary">
          {startClock}
        </Text>
        {dayPeriod ? (
          <Text variant="caption" className="tabular-nums">
            {dayPeriod}
          </Text>
        ) : null}
      </View>
      <View
        className={cn("flex-row gap-3", stacked ? "self-stretch" : "flex-1")}
      >
        {accentColor ? (
          <View
            className="w-1 self-stretch rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        ) : null}
        <View className="flex-1 gap-1.5">
          <Text
            variant="label"
            className={cn(
              "font-semibold",
              feedStatusLabel !== undefined && "text-muted-foreground",
            )}
          >
            {title}
          </Text>
          {meta ? (
            <Text variant="caption" numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
          {status === "now" ||
          ended ||
          feedStatusLabel ||
          ageBadge ||
          reminderLabel ? (
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="flex-row flex-wrap items-center gap-1.5"
            >
              {feedStatusLabel ? (
                <Badge
                  variant="ended"
                  emphasis="strong"
                  label={feedStatusLabel}
                />
              ) : status === "now" && statusLabel ? (
                <Badge variant="active" emphasis="strong" label={statusLabel} />
              ) : ended && statusLabel ? (
                <Badge variant="ended" label={statusLabel} />
              ) : null}
              {ageBadge ? (
                <Badge
                  variant={ageBadge.variant}
                  emphasis="strong"
                  label={ageBadge.label}
                />
              ) : null}
              {reminderLabel ? (
                <Badge variant="info" label={reminderLabel} />
              ) : null}
            </View>
          ) : null}
          {conflictLabel ? (
            <Text variant="caption" className="text-destructive">
              {conflictLabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});
