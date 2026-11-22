/**
 * The words on schedule rows, shared by the convention screen and the Schedule
 * tab so the two cannot phrase the same event differently.
 */

import type { TFunction } from "i18next";
import { type AgendaGap, type AgendaStatus, splitMinutes } from "./agenda-gaps";

/** The text of a gap row between two saved events. */
export function agendaGapLabel(gap: AgendaGap, t: TFunction): string {
  if (gap.kind === "backToBack") return t("convention.plan.gap.backToBack");
  if (gap.kind === "overlap")
    return t("convention.plan.gap.overlap", { minutes: gap.minutes });
  if (gap.hint === "short")
    return t("convention.plan.gap.free", { minutes: gap.minutes });
  const { hours, minutes } = splitMinutes(gap.minutes);
  return minutes === 0
    ? t("convention.plan.gap.freeHours", { hours })
    : t("convention.plan.gap.freeHoursMinutes", { hours, minutes });
}

/** "Now", "Ended" and so on; an upcoming event carries no status. */
export function agendaStatusLabel(
  status: AgendaStatus,
  t: TFunction,
): string | undefined {
  if (status === "now") return t("convention.plan.status.now");
  if (status === "endedToday") return t("convention.plan.status.endedToday");
  if (status === "ended") return t("convention.plan.status.ended");
  return undefined;
}

/** Why the feed no longer publishes an event, or null while it still does. */
export function feedStatusLabel(
  feedStatus: "cancelled" | "removed" | null | undefined,
  t: TFunction,
): string | null {
  if (!feedStatus) return null;
  return t(
    feedStatus === "cancelled"
      ? "convention.feedStatus.cancelled"
      : "convention.feedStatus.removed",
  );
}

/**
 * The reminder chip on an event row. Unlike the Settings default, 0 reads as
 * "0 min before" here, not "At event time".
 */
export function eventReminderLabel(
  minutes: number | null,
  t: TFunction,
): string | undefined {
  if (minutes === null) return undefined;
  return t(
    minutes === 60 ? "reminders.hourBefore" : "reminders.minutesBefore",
    {
      minutes,
    },
  );
}
