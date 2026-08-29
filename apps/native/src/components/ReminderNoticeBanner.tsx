import { useTranslation } from "react-i18next";
import { Linking, Pressable, View } from "react-native";
import { Text } from "@/components/ui";
import type { ReminderNotice } from "@/lib/reminder-notice";

/**
 * The "reminders are paused / waiting" banner, shared between the convention
 * schedule and the Schedule tab. The Schedule tab matters most: it is where
 * widget deep links land, so a user arriving there with notifications revoked
 * used to see reminder badges with nothing explaining that they were inert.
 */
interface ReminderNoticeBannerProps {
  notice: ReminderNotice;
  overflow: number;
}

export function ReminderNoticeBanner({
  notice,
  overflow,
}: ReminderNoticeBannerProps) {
  const { t } = useTranslation();
  if (notice === "none") return null;

  return (
    <View className="mx-4 mb-2 rounded-xl bg-secondary px-3 py-2">
      <Text variant="label" accessibilityRole="alert">
        {t(
          notice === "permission"
            ? "reminders.pausedTitle"
            : "reminders.overflowTitle",
        )}
      </Text>
      <Text variant="caption" className="pt-0.5 text-muted-foreground">
        {t(
          notice === "permission"
            ? "reminders.pausedMessage"
            : "reminders.overflowMessage",
          { count: overflow },
        )}
      </Text>
      {notice === "permission" ? (
        <Pressable
          onPress={() => {
            void Linking.openSettings();
          }}
          accessibilityRole="button"
          accessibilityLabel={t("reminders.openSettings")}
          className="min-h-11 justify-center active:opacity-70"
        >
          <Text className="text-primary">{t("reminders.openSettings")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
