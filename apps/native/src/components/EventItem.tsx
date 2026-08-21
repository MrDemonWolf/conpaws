import { AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, useColorScheme, View } from "react-native";
import { Badge, type BadgeVariant, Text } from "@/components/ui";
import type { AgeRating } from "@/lib/event-categories";
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
  isInSchedule?: boolean;
  reminderLabel?: string;
  /**
   * Provenance is only meaningful when a convention actually mixes imported
   * and hand-added events. Labelling every row "Imported" is noise.
   */
  provenanceLabel?: string;
  hasConflict?: boolean;
  contentWarning?: boolean;
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
  isInSchedule = false,
  reminderLabel,
  provenanceLabel,
  hasConflict = false,
  contentWarning = false,
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
  const meta = [category, room].filter(Boolean).join(" · ");
  const summary = description?.trim() ? description.trim() : null;

  const accessibilityDetails = [
    title,
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
    contentWarning ? t("convention.contentWarning") : null,
    summary,
  ]
    .filter(Boolean)
    .join(", ");

  return (
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
      className={cn(
        // min-h-14 is the 44pt minimum tap target; py-3 gives the 8pt rhythm
        // the old py-2 broke.
        "min-h-14 flex-row gap-3 border-b border-border px-4 py-3 active:opacity-70",
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
            {isInSchedule ? (
              <Text className="text-primary text-base leading-none">✓</Text>
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
}
