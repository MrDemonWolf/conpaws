import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Banner, useBannerIconColor } from "@/components/ui";

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
  // --color-info-foreground, AAA-asserted against --color-info by
  // theme-contrast.test.ts.
  const infoForeground = useBannerIconColor("info");

  return (
    <Banner
      tone="info"
      className="my-2"
      body={t("convention.scheduleHint.body")}
      leading={<Star size={17} color={infoForeground} fill={infoForeground} />}
      dismissLabel={t("convention.scheduleHint.dismiss")}
      onDismiss={onDismiss}
    />
  );
}
