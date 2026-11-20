import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { plannedEvent, validateDropInVisit } from "@/lib/drop-in-visit";
import {
  cancelEventReminder,
  getNotificationPermissionStatus,
  scheduleEventReminder,
  withReminderLock,
} from "./notifications";

interface SaveDropInVisitOptions {
  /**
   * Asked before the first OS notification dialog. Resolving false saves the
   * visit without that dialog; the reminder stays saved as the user's intent.
   */
  confirmPermissionPrompt?: () => Promise<boolean>;
}

export async function saveDropInVisit(
  event: ConventionEvent,
  draft: { date: string; time: string; durationMinutes: number },
  timeZone: string,
  reminderMinutes: number | null,
  { confirmPermissionPrompt }: SaveDropInVisitOptions = {},
): Promise<void> {
  const result = validateDropInVisit(event, draft, timeZone);
  if (!result.ok || event.feedStatus !== null) throw new Error("invalid-visit");
  if (
    reminderMinutes !== null &&
    ![0, 5, 10, 15, 30, 60].includes(reminderMinutes)
  )
    throw new Error("invalid-reminder");
  const requestPermission =
    reminderMinutes === null ||
    !confirmPermissionPrompt ||
    (await getNotificationPermissionStatus()) !== "undetermined" ||
    (await confirmPermissionPrompt());
  try {
    if (reminderMinutes !== null) {
      const request = await scheduleEventReminder(
        {
          id: event.id,
          title: event.title,
          room: event.room ?? event.location,
          conventionId: event.conventionId,
          startTime: result.startTime,
        },
        reminderMinutes,
        { requestPermission },
      );
      // No request means the reminder can no longer fire or permission is
      // missing. Only the first blocks the visit: reminderMinutes records the
      // intent, which reconcileEventReminders arms once permission returns.
      if (!request && (await getNotificationPermissionStatus()) === "granted")
        throw new Error("reminder-unavailable");
    } else if (!(await cancelEventReminder(event.id))) {
      throw new Error("cancel-failed");
    }
    const current = await eventsRepo.getById(event.id);
    const currentVisit =
      current && validateDropInVisit(current, draft, timeZone);
    if (
      !current ||
      current.feedStatus !== null ||
      !currentVisit?.ok ||
      currentVisit.startTime !== result.startTime
    )
      throw new Error("invalid-visit");
    await eventsRepo.update(event.id, {
      visitStartTime: result.startTime,
      visitEndTime: result.endTime,
      isInSchedule: true,
      reminderMinutes,
    });
  } catch (error) {
    await cancelEventReminder(event.id);
    await restoreStoredReminder(event.id);
    throw error;
  }
}

export function removeDropInVisit(event: ConventionEvent): Promise<void> {
  // One step against the reminder reconcile, which would otherwise re-file the
  // reminder from a read taken before this cleared it.
  return withReminderLock(async () => {
    if (!(await cancelEventReminder(event.id)))
      throw new Error("cancel-failed");
    try {
      await eventsRepo.update(event.id, {
        visitStartTime: null,
        visitEndTime: null,
        isInSchedule: false,
        reminderMinutes: null,
      });
    } catch (error) {
      await restoreStoredReminder(event.id);
      throw error;
    }
  });
}

async function restoreStoredReminder(eventId: string): Promise<void> {
  try {
    const stored = await eventsRepo.getById(eventId);
    if (!stored || stored.feedStatus !== null) return;
    const previous = plannedEvent(stored);
    if (previous.reminderMinutes != null)
      await scheduleEventReminder(previous, previous.reminderMinutes, {
        requestPermission: false,
      });
  } catch {
    // The persisted intent is retried by startup reconciliation.
  }
}
