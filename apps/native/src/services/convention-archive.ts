import * as conventionsRepo from "@/db/repositories/conventions";
import { reportError } from "@/lib/error-reporting";
import { recordReminderReconciliation } from "@/lib/reminder-notice";
import { reconcileEventReminders } from "./notifications";

/**
 * Archive cancelled the convention's OS reminders but kept the saved choices,
 * so unarchiving re-arms them now. Left to the next foreground reconcile, a
 * reminder due before the user reopens the app would never fire.
 */
export async function unarchiveConvention(id: string): Promise<void> {
  await conventionsRepo.unarchive(id);
  // Unarchiving already succeeded; reporting rather than throwing keeps the
  // "could not unarchive" alert honest. The next foreground reconcile retries.
  await reconcileEventReminders()
    .then(recordReminderReconciliation)
    .catch((error) => reportError(error, { scope: "reminders.unarchive" }));
}
