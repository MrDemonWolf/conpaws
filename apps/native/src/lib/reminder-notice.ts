import type { PermissionStatus } from "@/services/notifications";

/**
 * What a schedule screen has to tell the user about reminders it is showing.
 *
 * A row carries a reminder badge because `reminderMinutes` is set, which is
 * the record that the user asked for one. That is deliberately kept even when
 * the OS is holding no request -- permission was revoked, or the pending
 * ceiling was reached -- so the badge on its own can promise something that
 * will not happen. These notices are how the screen stays honest about it.
 */
export type ReminderNotice = "none" | "permission" | "overflow";

export interface ReminderNoticeInput {
  /** Null while the permission status is still being read. */
  permission: PermissionStatus | null;
  /** How many visible rows carry a saved reminder. */
  reminderCount: number;
  /** Reminders the last reconciliation could not hand to the OS. */
  overflow: number;
}

export function resolveReminderNotice({
  permission,
  reminderCount,
  overflow,
}: ReminderNoticeInput): ReminderNotice {
  if (reminderCount === 0) return "none";
  // Permission first: with it revoked, nothing is scheduled at all, which
  // makes the ceiling beside the point.
  if (permission !== null && permission !== "granted") return "permission";
  if (overflow > 0) return "overflow";
  return "none";
}

interface ReminderReconciliationCounts {
  overflow: number;
}

let lastReconciliation: ReminderReconciliationCounts = { overflow: 0 };

/**
 * Remembers what the last reconciliation could not schedule.
 *
 * Reconciliation runs outside any screen (at launch, and after a language
 * change re-renders the notification text), so its counts have to be parked
 * somewhere the screens can read them.
 */
export function recordReminderReconciliation(
  counts: ReminderReconciliationCounts,
): void {
  lastReconciliation = { overflow: counts.overflow };
}

export function getReminderReconciliation(): ReminderReconciliationCounts {
  return lastReconciliation;
}
