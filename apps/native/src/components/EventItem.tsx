import { AlertTriangle, Clock, Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, useColorScheme, View } from "react-native";
import { Badge, type BadgeVariant, Text } from "@/components/ui";
import type { ClusterPosition } from "@/lib/day-band";
import type { AgeRating } from "@/lib/event-categories";
import { themeTokens } from "@/lib/theme-tokens";
import { cn } from "@/lib/utils";

/** Only ratings that restrict who may attend get a pill. */
const AGE_BADGES: Partial<
  Record<AgeRating, { variant: BadgeVariant; key: string }>
> = {
  teen: { variant: "age-teen", key: "convention.ageRatings.teen" },
  mature: { variant: "age-mature", key: "convention.ageRatings.mature" },
  adult: { variant: "age-adult", key: "convention.ageRatings.adult" },
};

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
  contentWarning = false,
  overlapPosition,
  overlapGroupSize,
  overlapCount = 0,
  showScheduleIndicator = true,
  onPress,
  onLongPress,
  interactive = true,
  className,
  testID,
}: EventItemProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  const ageBadge = ageRating ? AGE_BADGES[ageRating] : undefined;
  const ageLabel = ageBadge ? t(ageBadge.key) : null;
  const meta = [contextLabel, category, room].filter(Boolean).join(" · ");
  const summary = description?.trim() ? description.trim() : null;

  const accessibilityDetails = [
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
      style={inCluster ? clusterEdge : undefined}
      className={cn(
        // min-h-14 is the 44pt minimum tap target; py-3 gives the 8pt rhythm
        // the old py-2 broke.
        "min-h-14 flex-row gap-3 border-b border-border px-4 py-3 active:opacity-70",
        // Overlap-group chrome: shared tint + accent edge mark every row of
        // the cluster; the edge, not colour alone, carries the grouping.
        inCluster && "bg-card",
        className,
      )}
    >
      <View className="w-20 shrink-0">
        <Text
          variant="label"
          className="tabular-nums text-primary"
          maxFontSizeMultiplier={1.6}
        >
          {startTime}
        </Text>
        {endTime ? (
          <Text
            variant="caption"
            className="tabular-nums"
            maxFontSizeMultiplier={1.6}
          >
            {endTime}
          </Text>
        ) : null}
      </View>

      <View className="flex-1 gap-1.5">
        <View className="flex-row items-start justify-between gap-2">
          <Text variant="label" className="flex-1 font-semibold">
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
                // Matches --color-age-mature-foreground in global.css, which
                // theme-contrast.test.ts holds at AAA against the card.
                color={isDark ? "#fed7aa" : "#7c2d12"}
              />
            ) : null}
            {isInSchedule && showScheduleIndicator ? (
              // A filled star, matching the Schedule tab's icon and the
              // "star an event" copy — the old ✓ glyph shared no vocabulary
              // with either.
              <Star
                size={15}
                color={themeTokens[isDark ? "dark" : "light"].primary}
                fill={themeTokens[isDark ? "dark" : "light"].primary}
              />
            ) : null}
          </View>
        </View>

        {ageLabel || meta ? (
          <View className="flex-row flex-wrap items-center gap-2">
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
