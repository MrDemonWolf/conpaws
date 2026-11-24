import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { hasVisit, plannedEvent } from "@/lib/drop-in-visit";
import { reportError } from "@/lib/error-reporting";
import { removeDropInVisit } from "./drop-in-visit";
import {
  cancelEventReminder,
  scheduleEventReminder,
  withReminderLock,
} from "./notifications";
import { stopTrackingIfAffected } from "./tracked-event";

/**
 * Saving and unsaving one event, shared by the phone's star and the commands
 * the Watch sends. Both must leave the row, the OS reminder and the tracked
 * event in the same state, so there is one implementation of each. Feedback
 * (haptics, announcements, cache invalidation) stays with the caller.
 */

/**
 * An event taken off the schedule stops being tracked straight away, rather
 * than at the next reconcile. The schedule write has already succeeded by the
 * time this runs, so a failure here is reported instead of failing the
 * change; the reconcile that follows every widget publication still catches
 * it, because the row now reads as unsaved.
 */
export async function stopTrackingUnsaved(
  eventIds: readonly string[],
): Promise<void> {
  if (eventIds.length === 0) return;
  try {
    await stopTrackingIfAffected({ eventIds }, "unsaved");
  } catch (error) {
    reportError(error, { scope: "trackedEvent.unsaved" });
  }
}

export interface SaveEventOptions {
  /**
   * A lead time to arm with the save, or null for none. The star passes none:
   * the user picks one later from a picker that suggests the Settings default.
   * A Watch tap cannot show that picker, so it passes the default itself.
   */
  reminderMinutes?: number | null;
}

/**
 * Marks the event saved, with the reminder `reminderMinutes` asks for when it
 * can fire: notifications are already allowed (this never asks) and the time
 * is still ahead. Otherwise, or when arming it fails, the event is saved
 * without one, as the star saves it. A reminder the row already has is the
 * user's own choice and stays; the reconcile keeps it armed.
 */
export async function saveEventToPlan(
  event: ConventionEvent,
  { reminderMinutes = null }: SaveEventOptions = {},
): Promise<void> {
  if (reminderMinutes === null || event.reminderMinutes !== null) {
    await eventsRepo.update(event.id, { isInSchedule: true });
    return;
  }
  // One step against the reminder reconcile, which would otherwise cancel the
  // new request as stale from a read taken before the row recorded it.
  await withReminderLock(async () => {
    let armed = false;
    try {
      armed =
        (await scheduleEventReminder(
          {
            id: event.id,
            title: event.title,
            startTime: plannedEvent(event).startTime,
            room: event.room ?? event.location,
            conventionId: event.conventionId,
          },
          reminderMinutes,
          { requestPermission: false },
        )) !== null;
    } catch (error) {
      reportError(error, { scope: "eventSchedule.defaultReminder" });
    }
    try {
      // Recorded only once the OS holds it, so the row never shows a reminder
      // that will not arrive.
      await eventsRepo.update(
        event.id,
        armed
          ? { isInSchedule: true, reminderMinutes }
          : { isInSchedule: true },
      );
    } catch (error) {
      if (armed) await cancelEventReminder(event.id);
      throw error;
    }
  });
}

/**
 * Takes the event off the plan: a drop-in's visit goes with it, and so does
 * the reminder. Leaving one armed fires a "time to leave" notification for a
 * panel the user has already dropped, and the row no longer shows a badge
 * that would explain it.
 */
export async function removeEventFromPlan(
  event: ConventionEvent,
): Promise<void> {
  if (hasVisit(event)) {
    await removeDropInVisit(event);
    await stopTrackingUnsaved([event.id]);
    return;
  }
  if (event.reminderMinutes === null) {
    await eventsRepo.update(event.id, { isInSchedule: false });
    await stopTrackingUnsaved([event.id]);
    return;
  }
  // One step against the reminder reconcile, which would otherwise re-file the
  // reminder from a read taken before this cleared it.
  await withReminderLock(async () => {
    await cancelEventReminder(event.id);
    await eventsRepo.update(event.id, {
      isInSchedule: false,
      reminderMinutes: null,
    });
  });
  await stopTrackingUnsaved([event.id]);
}

/** The star: `event` is the row as it was before the tap. */
export function toggleEventInPlan(event: ConventionEvent): Promise<void> {
  return event.isInSchedule
    ? removeEventFromPlan(event)
    : saveEventToPlan(event);
}
