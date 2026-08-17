export interface ScheduleViewEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
}

// End times are optional for manual and imported events. Keep them visible in
// Now for one hour instead of dropping them at their start time.
const NO_END_FALLBACK_MS = 60 * 60 * 1000;

function compareEvents(
  left: ScheduleViewEvent,
  right: ScheduleViewEvent,
): number {
  return (
    Date.parse(left.startTime) - Date.parse(right.startTime) ||
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
  const validEvents = events.filter((event) =>
    Number.isFinite(Date.parse(event.startTime)),
  );

  const current = validEvents
    .filter((event) => {
      const start = Date.parse(event.startTime);
      const end = event.endTime
        ? Date.parse(event.endTime)
        : start + NO_END_FALLBACK_MS;
      return (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        end > start &&
        start <= nowMs &&
        nowMs < end
      );
    })
    .sort(compareEvents);

  const upcoming = validEvents.filter(
    (event) => Date.parse(event.startTime) > nowMs,
  );
  const nextStart = upcoming.reduce(
    (earliest, event) => Math.min(earliest, Date.parse(event.startTime)),
    Number.POSITIVE_INFINITY,
  );
  const next = upcoming
    .filter((event) => Date.parse(event.startTime) === nextStart)
    .sort(compareEvents);

  return { current, next };
}
