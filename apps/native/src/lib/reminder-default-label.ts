import type { TFunction } from "i18next";

/**
 * How a default-reminder lead time reads to a person.
 *
 * Shared because two places have to agree on it: the Settings row that shows
 * the current value, and the screen that lists the options. They used to be
 * one `<Picker>`, which needed the labels only once.
 *
 * `null` is "no default", not "at event time" -- 0 already means at the event.
 */
export function reminderDefaultLabel(
  minutes: number | null,
  t: TFunction,
): string {
  if (minutes === null) return t("settings.notifications.noDefault");
  if (minutes === 0) return t("reminders.atTime");
  if (minutes === 60) return t("reminders.hourBefore");
  return t("reminders.minutesBefore", { minutes });
}
