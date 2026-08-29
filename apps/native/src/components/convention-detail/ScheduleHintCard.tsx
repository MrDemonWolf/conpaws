import { Star, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, useColorScheme, View } from "react-native";
import { Text } from "@/components/ui";

/**
 * One-time hint on the convention schedule that teaches the app's core
 * mechanic: tap an event to add it to My Schedule. Shown only while the
 * convention has events and none are starred, and never again after dismissal
 * (schedule-hint-storage). The Schedule tab's empty state tells users to
 * "star an event inside a convention" — this card is the other end of that
 * sentence, on the screen where starring actually happens.
 */
interface ScheduleHintCardProps {
  onDismiss: () => void;
}

export function ScheduleHintCard({ onDismiss }: ScheduleHintCardProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === "dark";
  // --color-info-foreground, AAA-asserted against --color-info by
  // theme-contrast.test.ts. Icon colors are props, so hex is unavoidable —
  // same documented pattern as EventItem's content-warning triangle.
  const infoForeground = isDark ? "#bfdbfe" : "#1e40af";

  return (
    <View className="mx-4 my-2 flex-row items-center gap-3 rounded-xl bg-info p-3">
      <Star size={17} color={infoForeground} fill={infoForeground} />
      <Text variant="caption" className="flex-1 text-info-foreground">
        {t("convention.scheduleHint.body")}
      </Text>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("convention.scheduleHint.dismiss")}
        hitSlop={12}
        className="active:opacity-70"
      >
        <X size={17} color={infoForeground} />
      </Pressable>
    </View>
  );
}
