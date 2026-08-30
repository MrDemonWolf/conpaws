import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

import { Banner } from "@/components/ui";
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

  const isPermission = notice === "permission";

  return (
    <Banner
      title={t(
        isPermission ? "reminders.pausedTitle" : "reminders.overflowTitle",
      )}
      body={t(
        isPermission ? "reminders.pausedMessage" : "reminders.overflowMessage",
        { count: overflow },
      )}
      actionLabel={isPermission ? t("reminders.openSettings") : undefined}
      onAction={
        isPermission
          ? () => {
              void Linking.openSettings();
            }
          : undefined
      }
    />
  );
}
