import { AlertTriangle, ShieldAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, useColorScheme, View } from "react-native";
import { Badge, Text } from "@/components/ui";
import { cn } from "@/lib/utils";

interface EventItemProps {
  title: string;
  startTime: string;
  endTime?: string;
  room?: string;
  category?: string;
  isInSchedule?: boolean;
  reminderLabel?: string;
  provenanceLabel?: string;
  hasConflict?: boolean;
  isAgeRestricted?: boolean;
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
  isInSchedule = false,
  reminderLabel,
  provenanceLabel,
  hasConflict = false,
  isAgeRestricted = false,
  contentWarning = false,
  onPress,
  onLongPress,
  interactive = true,
  className,
  testID,
}: EventItemProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const accessibilityDetails = [
    title,
    endTime
      ? t("convention.eventTimeRange", { start: startTime, end: endTime })
      : startTime,
    room,
    category,
    isInSchedule
      ? t("convention.inMySchedule")
      : t("convention.notInMySchedule"),
    reminderLabel ? `${t("convention.reminderSet")}: ${reminderLabel}` : null,
    provenanceLabel,
    hasConflict ? t("convention.overlapLabel") : null,
    isAgeRestricted ? t("convention.ageRestricted") : null,
    contentWarning ? t("convention.contentWarning") : null,
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
        "min-h-14 flex-row items-center gap-3 border-b border-border px-4 py-2 active:opacity-70",
        className,
      )}
    >
      <View className="min-w-20 shrink-0 justify-center">
        <Text variant="label" className="tabular-nums text-primary">
          {startTime}
        </Text>
        {endTime ? (
          <Text variant="caption" className="tabular-nums">
            {endTime}
          </Text>
        ) : null}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center justify-between">
          <Text variant="label" className="flex-1 pr-2">
            {title}
          </Text>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row items-center gap-1.5"
          >
            {isAgeRestricted && (
              <ShieldAlert size={14} color={isDark ? "#FCA5A5" : "#B42318"} />
            )}
            {contentWarning && (
              <AlertTriangle size={14} color={isDark ? "#FCD34D" : "#854D0E"} />
            )}
            {isInSchedule && <Text className="text-primary text-lg">✓</Text>}
          </View>
        </View>
        {category || room ? (
          <Text variant="caption" numberOfLines={2}>
            {[category, room].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {reminderLabel !== undefined || provenanceLabel !== undefined ? (
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="flex-row flex-wrap gap-1.5 pt-1"
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
