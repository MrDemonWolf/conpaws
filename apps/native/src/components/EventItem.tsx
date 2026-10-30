import { AlertTriangle, Clock, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { Badge, PRESS_DIM, Text } from "@/components/ui";
import { ageBadgeFor } from "@/lib/age-badge";
import type { ClusterPosition } from "@/lib/day-band";
import type { AgeRating } from "@/lib/event-categories";
import { themeTokens } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";

interface EventItemProps {
  title: string;
  startTime: string;
  endTime?: string;
  room?: string;
  category?: string;
  description?: string | null;
  ageRating?: AgeRating | null;
  /**
   * Where this event comes from, when that is not already obvious. The
   * Schedule tab pools events from several conventions into one list, so a
   * row there has to say which one it belongs to.
   */
  contextLabel?: string;
  isInSchedule?: boolean;
  reminderLabel?: string;
  /**
   * Provenance is only meaningful when a convention actually mixes imported
   * and hand-added events. Labelling every row "Imported" is noise.
   */
  provenanceLabel?: string;
  hasConflict?: boolean;
  /**
   * Set when the feed this event came from stopped publishing it. The row
   * stays on the schedule, dimmed and badged, because a saved panel that
   * simply vanishes turns "wasn't there something at three?" into a question
   * the app refuses to answer.
   */
  feedStatus?: "cancelled" | "removed" | null;
  contentWarning?: boolean;
  /**
   * Overlap grouping from `overlapInfo` (src/lib/day-band.ts). Rows in a
   * cluster draw their own share of the group chrome — tint, accent edge,
   * and the header on the "first" row — because a SectionList cannot wrap
   * several virtualized rows in one card. "solo"/undefined renders plain.
   */
  overlapPosition?: ClusterPosition;
  /** Cluster size, shown in the first row's "N events at the same time" header. */
  overlapGroupSize?: number;
  /** Exact number of other events sharing this timeframe, for screen readers. */
  overlapCount?: number;
  /**
   * The Schedule tab sets this false: every row there is starred by
   * definition, so a star on each would mean nothing.
   */
  showScheduleIndicator?: boolean;
  /**
   * The category's accent, drawn as a thin bar at the start of the row. Pure
   * decoration: the category name is always printed too, and overlap grouping
   * keeps its own primary-coloured edge, so nothing is said by hue alone.
   */
  accentColor?: string | null;
  /**
   * "Saved", printed as a pill when the event is in the schedule. The star
   * glyph used to carry this alone; a word survives colour-blindness and
   * reads aloud.
   */
  savedLabel?: string;
  /**
   * A visible star button on the trailing edge, the discoverable twin of the
   * swipe. Its label should name the event and the action.
   */
  trailingAction?: {
    label: string;
    selected: boolean;
    onPress: () => void;
    testID?: string;
  };
  onPress?: () => void;
  onLongPress?: () => void;
  interactive?: boolean;
  className?: string;
  testID?: string;
}

export function EventItem({
  title,
  startTime,
  endTime,
  room,
  category,
  description,
  ageRating,
  contextLabel,
  isInSchedule = false,
  reminderLabel,
  provenanceLabel,
  hasConflict = false,
  feedStatus = null,
  contentWarning = false,
  overlapPosition,
  overlapGroupSize,
  overlapCount = 0,
  showScheduleIndicator = true,
  accentColor,
  savedLabel,
  trailingAction,
  onPress,
  onLongPress,
  interactive = true,
  className,
  testID,
}: EventItemProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  // Past this scale the 80pt time column squeezes titles to a few letters.
  const stacked = fontScale >= 1.6;
  const isDark = useColorScheme() === "dark";
  const ageBadge = ageBadgeFor(ageRating);
  const ageLabel = ageBadge ? t(ageBadge.key) : null;
  const feedStatusLabel = feedStatus
    ? t(
        feedStatus === "cancelled"
          ? "convention.feedStatus.cancelled"
          : "convention.feedStatus.removed",
      )
    : null;
  const meta = [contextLabel, category, room].filter(Boolean).join(" · ");
  const summary = description?.trim() ? description.trim() : null;

  const accessibilityDetails = [
    // First, so VoiceOver says the panel is off before reading its time and
    // room. Hearing "Room A, three o'clock" and only then "cancelled" wastes
    // the listener's attention on a plan that no longer exists.
    feedStatusLabel,
    title,
    contextLabel,
    endTime
      ? t("convention.eventTimeRange", { start: startTime, end: endTime })
      : startTime,
    // Announced right after the time so a screen-reader user hears the age
    // gate before the description, not buried after it.
    ageLabel,
    room,
    category,
    isInSchedule
      ? t("convention.inMySchedule")
      : t("convention.notInMySchedule"),
    reminderLabel ? `${t("convention.reminderSet")}: ${reminderLabel}` : null,
    provenanceLabel,
    hasConflict ? t("convention.overlapLabel") : null,
    overlapCount > 0
      ? t(
          overlapCount === 1
            ? "convention.runsAlongsideOne"
            : "convention.runsAlongsideMany",
          { count: overlapCount },
        )
      : null,
    contentWarning ? t("convention.contentWarning") : null,
    summary,
  ]
    .filter(Boolean)
    .join(", ");

  const inCluster = overlapPosition !== undefined && overlapPosition !== "solo";
  // The accent edge is a style, not a class: NativeWind 5 preview has no
  // directional border-colour utility, and `border-l-primary` resolved to an
  // undefined style object ("Cannot convert undefined value to object").
  const clusterEdge = {
    borderLeftWidth: 3,
    borderLeftColor: themeTokens[isDark ? "dark" : "light"].primary,
  } as const;

  const row = (
    <Pressable
      testID={testID}
      onPress={interactive ? onPress : undefined}
      onLongPress={interactive ? onLongPress : undefined}
      delayLongPress={400}
      accessibilityRole={interactive ? "button" : undefined}
      accessibilityLabel={accessibilityDetails}
      accessibilityHint={
        interactive ? t("convention.eventActionsHint") : undefined
      }
      accessibilityState={{ selected: isInSchedule }}
      accessibilityActions={
        trailingAction
          ? [{ name: "activate", label: trailingAction.label }]
          : undefined
      }
      onAccessibilityAction={
        trailingAction
          ? (event) => {
              if (event.nativeEvent.actionName === "activate") {
                trailingAction.onPress();
              }
            }
          : undefined
      }
      style={inCluster ? clusterEdge : undefined}
      className={cn(
        // min-h-14 is the 44pt minimum tap target; py-3 gives the 8pt rhythm
        // the old py-2 broke.
        "min-h-14 gap-3 border-b border-border px-4 py-3",
        stacked ? "flex-col" : "flex-row",
        PRESS_DIM,
        // Overlap-group chrome: shared tint + accent edge mark every row of
        // the cluster; the edge, not colour alone, carries the grouping.
        inCluster && "bg-card",
        className,
      )}
    >
      {accentColor ? (
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className={cn(
            "rounded-full",
            stacked ? "h-1 w-10" : "w-1 self-stretch",
          )}
          style={{ backgroundColor: accentColor }}
        />
      ) : null}
      <View className="min-w-20 shrink-0">
        <Text variant="label" className="tabular-nums text-primary">
          {startTime}
        </Text>
        {endTime ? (
          <Text variant="caption" className="tabular-nums">
            {endTime}
          </Text>
        ) : null}
      </View>

      {/* flex-1 only beside the time column: in the stacked layout the row's
          height is content-sized, so flex-1's zero basis collapsed this whole
          block and only the times showed. */}
      <View className={cn("gap-1.5", stacked ? "self-stretch" : "flex-1")}>
        <View className="flex-row items-start justify-between gap-2">
          <Text
            variant="label"
            className={cn(
              "flex-1 font-semibold",
              // Dimmed, never struck through. A line through the title is
              // decoration VoiceOver cannot see, and it punishes low-vision
              // readers; the badge below carries the meaning instead.
              feedStatus !== null && "text-muted-foreground",
            )}
          >
            {title}
          </Text>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row items-center gap-1.5 pt-0.5"
          >
            {contentWarning ? (
              <AlertTriangle
                size={15}
                // --color-age-mature-foreground, held at AAA against the card
                // by theme-contrast.test.ts. Read from themeTokens rather than
                // retyped, so theme-tokens.test.ts covers it too.
                color={
                  themeTokens[isDark ? "dark" : "light"].ageMatureForeground
                }
              />
            ) : null}
            {isInSchedule && showScheduleIndicator && !trailingAction ? (
              // A filled star, matching the Schedule tab's icon and the
              // "star an event" copy — the old ✓ glyph shared no vocabulary
              // with either. Hidden when the row has its own star button.
              <Star
                size={15}
                color={themeTokens[isDark ? "dark" : "light"].primary}
                fill={themeTokens[isDark ? "dark" : "light"].primary}
              />
            ) : null}
          </View>
        </View>

        {ageLabel || meta || (isInSchedule && savedLabel) ? (
          <View className="flex-row flex-wrap items-center gap-2">
            {isInSchedule && showScheduleIndicator && savedLabel ? (
              <Badge variant="active" label={savedLabel} />
            ) : null}
            {ageBadge && ageLabel ? (
              <Badge
                variant={ageBadge.variant}
                label={ageLabel}
                emphasis="strong"
              />
            ) : null}
            {meta ? (
              <Text
                variant="caption"
                className="shrink"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {meta}
              </Text>
            ) : null}
          </View>
        ) : null}

        {summary ? (
          // Truncated here; the full text lives in the event's action sheet,
          // which is what tapping the row already opens.
          <Text
            variant="caption"
            className="text-muted-foreground"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {summary}
          </Text>
        ) : null}

        {feedStatusLabel !== null ? (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row"
          >
            <Badge variant="ended" emphasis="strong" label={feedStatusLabel} />
          </View>
        ) : null}

        {reminderLabel !== undefined || provenanceLabel !== undefined ? (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row flex-wrap gap-1.5"
          >
            {reminderLabel !== undefined ? (
              <Badge variant="info" label={reminderLabel} />
            ) : null}
            {provenanceLabel !== undefined ? (
              <Badge variant="neutral" label={provenanceLabel} />
            ) : null}
          </View>
        ) : null}

        {hasConflict ? (
          <Text variant="caption" className="text-destructive">
            {t("convention.overlapLabel")}
          </Text>
        ) : null}
      </View>

      {trailingAction ? (
        // A plain RN pressable with a lucide glyph, not an @expo/ui Host: on
        // Android a Host inside a Pressable swallows the touch.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={trailingAction.label}
          accessibilityState={{ selected: trailingAction.selected }}
          hitSlop={4}
          onPress={trailingAction.onPress}
          testID={trailingAction.testID}
          className={cn(
            "h-11 w-11 items-center justify-center rounded-full",
            stacked ? "self-end" : "self-center",
            PRESS_DIM,
          )}
        >
          <Star
            size={22}
            color={themeTokens[isDark ? "dark" : "light"].primary}
            fill={
              trailingAction.selected
                ? themeTokens[isDark ? "dark" : "light"].primary
                : "transparent"
            }
          />
        </Pressable>
      ) : null}
    </Pressable>
  );

  if (overlapPosition !== "first") return row;

  return (
    <View>
      {/* Sighted-only group header; VoiceOver hears the per-row "runs at the
          same time as N other events" sentence instead. */}
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={clusterEdge}
        className="flex-row items-center gap-1.5 bg-card px-4 pt-2.5 pb-1"
      >
        <Clock
          size={13}
          color={themeTokens[isDark ? "dark" : "light"].primary}
        />
        <Text variant="caption" className="font-semibold text-primary">
          {t("convention.sameTimeGroup", {
            count: overlapGroupSize ?? overlapCount + 1,
          })}
        </Text>
      </View>
      {row}
    </View>
  );
}
