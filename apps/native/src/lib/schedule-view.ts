import {
  formatInConventionTime,
  fromConventionTime,
} from "@/lib/convention-time";
import { attendanceInterval } from "@/lib/personal-schedule";

export interface ScheduleViewEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  personalStartTime?: string | null;
  personalEndTime?: string | null;
  room: string | null;
}

export interface ScheduleSearchEvent {
  title: string;
  description?: string | null;
  category?: string | null;
  type?: string | null;
  room?: string | null;
  location?: string | null;
}

/** Match every source-backed text field that can identify a panel or person. */
export function eventMatchesScheduleSearch(
  event: ScheduleSearchEvent,
  query: string,
): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [
    event.title,
    event.description,
    event.category,
    event.type,
    event.room,
    event.location,
  ].some((value) => value?.toLocaleLowerCase().includes(normalized));
}

// End times are optional for manual and imported events. Keep them visible in
// Now for one hour instead of dropping them at their start time.
const NO_END_FALLBACK_MS = 60 * 60 * 1000;

function compareEvents(
  left: ScheduleViewEvent,
  right: ScheduleViewEvent,
): number {
  const leftStart = attendanceInterval(left).startTime;
  const rightStart = attendanceInterval(right).startTime;
  return (
    Date.parse(leftStart) - Date.parse(rightStart) ||
    (left.room ?? "").localeCompare(right.room ?? "") ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  );
}

export function getNowAndNextEvents<T extends ScheduleViewEvent>(
  events: readonly T[],
  now: Date = new Date(),
): { current: T[]; next: T[] } {
  const nowMs = now.getTime();
  const validEvents = events
    .map((event) => {
      const interval = attendanceInterval(event);
      return { event, interval, start: Date.parse(interval.startTime) };
    })
    .filter(({ start }) => Number.isFinite(start));

  const current = validEvents
    .filter(({ interval, start }) => {
      const end = interval.endTime
        ? Date.parse(interval.endTime)
        : start + NO_END_FALLBACK_MS;
      return (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end > start &&
        start <= nowMs &&
        nowMs < end
      );
    })
    .map(({ event }) => event)
    .sort(compareEvents);

  const upcoming = validEvents.filter(({ start }) => start > nowMs);
  const nextStart = upcoming.reduce(
    (earliest, { start }) => Math.min(earliest, start),
    Number.POSITIVE_INFINITY,
  );
  const next = upcoming
    .filter(({ start }) => start === nextStart)
    .map(({ event }) => event)
    .sort(compareEvents);

  return { current, next };
}

/** The event's published starting hour in the convention's local clock. */
export function eventConventionStartHour(
  event: Pick<ScheduleViewEvent, "startTime">,
  timeZone: string,
): number | null {
  const start = Date.parse(event.startTime);
  if (!Number.isFinite(start)) return null;
  const hour = Number(formatInConventionTime(event.startTime, timeZone, "H"));
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

/** Whether the published event intersects one convention-local calendar day. */
export function eventOccursOnConventionDay(
  event: Pick<ScheduleViewEvent, "startTime" | "endTime">,
  dayKey: string,
  timeZone: string,
): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return false;

  const start = Date.parse(event.startTime);
  if (!Number.isFinite(start)) return false;
  const end = event.endTime
    ? Date.parse(event.endTime)
    : start + NO_END_FALLBACK_MS;
  if (!Number.isFinite(end) || end <= start) return false;

  const day = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const dayStart = fromConventionTime(day, timeZone).getTime();
  const dayEnd = fromConventionTime(
    { ...day, day: day.day + 1 },
    timeZone,
  ).getTime();
  return start < dayEnd && dayStart < end;
}

/** Whether the published event intersects one local clock-hour slot. */
export function eventOccursInConventionHour(
  event: Pick<ScheduleViewEvent, "startTime" | "endTime">,
  dayKey: string,
  hour: number,
  timeZone: string,
): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match || !Number.isInteger(hour) || hour < 0 || hour > 23) return false;

  const start = Date.parse(event.startTime);
  if (!Number.isFinite(start)) return false;
  const end = event.endTime
    ? Date.parse(event.endTime)
    : start + NO_END_FALLBACK_MS;
  if (!Number.isFinite(end) || end <= start) return false;

  const slotStart = fromConventionTime(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour,
    },
    timeZone,
  ).getTime();
  const slotEnd = slotStart + NO_END_FALLBACK_MS;
  return start < slotEnd && slotStart < end;
}
