import type { TFunction } from "i18next";

/**
 * How a default or chosen reminder lead time reads to a person.
 *
 * Shared so every place that names one agrees: the Settings row, its inline
 * iOS menu (below accessibility text sizes) and the pushed reminder-default
 * list, the reminder choices in onboarding and the visit planner, the event's
 * reminder picker and the Now card. Schedule rows keep their own chip wording
 * (see `eventReminderLabel`), which reads 0 as "0 min before".
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
