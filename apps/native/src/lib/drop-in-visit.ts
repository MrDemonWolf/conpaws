import { formatInConventionTime, isValidTimeZone } from "./convention-time";
import { isDropInEvent } from "./schedule-browse";

export interface VisitEvent {
  startTime: string;
  endTime: string | null;
  visitStartTime?: string | null;
  visitEndTime?: string | null;
  isInSchedule: boolean;
  reminderMinutes?: number | null;
}

export const VISIT_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

export function hasVisit(event: VisitEvent): boolean {
  return event.visitStartTime != null || event.visitEndTime != null;
}

export function isValidVisit(
  event: VisitEvent,
): event is VisitEvent & { visitStartTime: string; visitEndTime: string } {
  if (!isDropInEvent(event) || !event.visitStartTime || !event.visitEndTime)
    return false;
  const start = Date.parse(event.visitStartTime);
  const end = Date.parse(event.visitEndTime);
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= Date.parse(event.startTime) &&
    end <= Date.parse(event.endTime ?? "") &&
    end > start
  );
}

/** Plan projections never overwrite the feed's opening hours or saved intent. */
export function plannedEvent<T extends VisitEvent>(event: T): T {
  if (!hasVisit(event))
    return isDropInEvent(event)
      ? { ...event, isInSchedule: false, reminderMinutes: null }
      : event;
  if (!isValidVisit(event))
    return { ...event, isInSchedule: false, reminderMinutes: null };
  return {
    ...event,
    startTime: event.visitStartTime,
    endTime: event.visitEndTime,
    visitStartTime: null,
    visitEndTime: null,
  };
}

export type VisitValidation =
  | { ok: true; startTime: string; endTime: string }
  | { ok: false; reason: "time-zone" | "time" | "window" | "duration" };

export function validateDropInVisit(
  event: VisitEvent,
  draft: { date: string; time: string; durationMinutes: number },
  timeZone: string,
): VisitValidation {
  if (!isValidTimeZone(timeZone)) return { ok: false, reason: "time-zone" };
  if (!isDropInEvent(event)) return { ok: false, reason: "window" };
  if (!VISIT_DURATIONS.includes(draft.durationMinutes as 15))
    return { ok: false, reason: "duration" };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
  )
    return { ok: false, reason: "time" };
  const wall = `${draft.date}T${draft.time}`;
  const nominal = Date.parse(`${wall}:00Z`);
  if (
    !Number.isFinite(nominal) ||
    new Date(nominal).toISOString().slice(0, 16) !== wall
  )
    return { ok: false, reason: "time" };
  const candidates = new Set<number>();
  for (const day of [-2, -1, 0, 1, 2]) {
    const sample = nominal + day * 86_400_000;
    const local = formatInConventionTime(
      new Date(sample),
      timeZone,
      "yyyy-MM-dd'T'HH:mm:ss",
    );
    const offset = Date.parse(`${local}Z`) - sample;
    const start = nominal - offset;
    if (
      formatInConventionTime(
        new Date(start),
        timeZone,
        "yyyy-MM-dd'T'HH:mm",
      ) === wall
    )
      candidates.add(start);
  }
  if (!candidates.size) return { ok: false, reason: "time" };
  const duration = draft.durationMinutes * 60_000;
  const starts = [...candidates].filter(
    (start) =>
      start >= Date.parse(event.startTime) &&
      start + duration <= Date.parse(event.endTime ?? ""),
  );
  if (!starts.length) return { ok: false, reason: "window" };
  const start = Math.min(...starts);
  return {
    ok: true,
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + duration).toISOString(),
  };
}

/**
 * Whether a reminder `minutesBefore` a visit starting at `startTime` would
 * already have fired. A visit to a drop-in that is open now usually starts
 * now, so the default lead time often lands in the past, where the system
 * cannot schedule it.
 */
export function visitReminderHasPassed(
  startTime: string,
  minutesBefore: number | null,
  nowMs: number,
): boolean {
  if (minutesBefore === null) return false;
  return Date.parse(startTime) - minutesBefore * 60_000 <= nowMs;
}
