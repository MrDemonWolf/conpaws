import * as eventsRepo from "@/db/repositories/events";
import type { ConventionEvent } from "@/db/schema";
import { hasVisit } from "@/lib/drop-in-visit";
import { reportError } from "@/lib/error-reporting";
import { removeDropInVisit } from "./drop-in-visit";
import { cancelEventReminder, withReminderLock } from "./notifications";
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

/** Marks the event saved. No reminder is set; the user picks one later. */
export async function saveEventToPlan(event: ConventionEvent): Promise<void> {
  await eventsRepo.update(event.id, { isInSchedule: true });
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
