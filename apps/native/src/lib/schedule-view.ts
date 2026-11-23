import { compareByStart, NO_END_FALLBACK_MS } from "./schedule-browse";

export interface ScheduleViewEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
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
    .sort(compareByStart);

  const upcoming = validEvents.filter(
    (event) => Date.parse(event.startTime) > nowMs,
  );
  const nextStart = upcoming.reduce(
    (earliest, event) => Math.min(earliest, Date.parse(event.startTime)),
    Number.POSITIVE_INFINITY,
  );
  const next = upcoming
    .filter((event) => Date.parse(event.startTime) === nextStart)
    .sort(compareByStart);

  return { current, next };
}
