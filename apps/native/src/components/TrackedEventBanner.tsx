import { useTranslation } from "react-i18next";

import { Banner } from "@/components/ui";
import { useTrackedEvent } from "@/hooks/useTrackedEvent";
import { useHour12 } from "@/lib/device-clock";
import { displayTimeZone } from "@/lib/display-time-zone";
import { plannedEvent } from "@/lib/drop-in-visit";
import {
  formatEventEndDateTime,
  scheduleFormatter,
} from "@/lib/event-time-format";
import { currentLocale } from "@/lib/i18n";

interface TrackedEventBannerProps {
  /**
   * Set on a convention's own schedule so another convention's tracked event
   * does not appear there. Left out on the Schedule tab, which spans them all.
   */
  conventionId?: string;
}

/**
 * The in-app Stop for Track event.
 *
 * The Live Activity and the ongoing notification both carry a Stop, but a
 * reader who cannot find or reach them (a swipe they cannot make, a Lock
 * Screen they never look at) needs a plain button inside the app as well.
 * This is that button, shown where the reader already looks at their plan.
 */
export function TrackedEventBanner({ conventionId }: TrackedEventBannerProps) {
  const { t } = useTranslation();
  const hour12 = useHour12();
  const { tracked, stop } = useTrackedEvent();

  if (!tracked) return null;
  if (conventionId !== undefined && tracked.convention.id !== conventionId) {
    return null;
  }

  // A drop-in is tracked by the visit the user planned, so the banner shows
  // that window rather than the whole drop-in's opening hours.
  const event = plannedEvent(tracked.event);
  const storedTimeZone = tracked.convention.timeZone;
  const timeZone = displayTimeZone(storedTimeZone);
  const locale = currentLocale();

  const start = new Date(event.startTime);
  const dateLine = Number.isNaN(start.getTime())
    ? null
    : scheduleFormatter("dateAndTime", locale, timeZone, hour12).format(start);
  // Same wording as the event sheet: a same-day end is just a clock time.
  const endLine = event.endTime
    ? formatEventEndDateTime(
        event.startTime,
        event.endTime,
        timeZone,
        locale,
        hour12,
      )
    : "";
  const room = event.room?.trim() || event.location?.trim() || null;
  const body = [
    [dateLine, endLine ? t("convention.timeRangeTo", { time: endLine }) : null]
      .filter(Boolean)
      .join(" "),
    room,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Banner
      tone="info"
      testID="tracked-event-banner"
      title={t("tracking.bannerTitle", { title: event.title })}
      body={body}
      // Banner uses its action label as the button's accessible name and has
      // no separate prop for one, so the visible text names the event too.
      // Voice Control can then match exactly what is on screen.
      actionLabel={t("tracking.stopAccessibility", { title: event.title })}
      onAction={() => {
        void stop();
      }}
    />
  );
}
