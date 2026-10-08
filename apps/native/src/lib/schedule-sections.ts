/**
 * Turns a convention's events into the sections the one schedule list renders,
 * for each of its three views: Browse (every event, filtered), My plan (saved
 * events with the gaps between them) and Now & next (what is on, what follows,
 * and what else is running this hour).
 *
 * Rows carry a `kind` so the list can mix event rows, agenda rows, gap rows and
 * drop-in rows in one virtualized list, and overlaps are keyed by event id
 * rather than by index because gap rows would shift the indices.
 */

import {
  type AgendaGap,
  type AgendaStatus,
  buildAgendaRows,
  describeAgendaGap,
} from "./agenda-gaps";
import { conventionDayKey } from "./convention-time";
import { type OverlapInfo, overlapInfoAmong } from "./day-band";
import {
  type BrowseEvent,
  type BrowseFilters,
  type BrowseSelection,
  HOUR_MS,
  hourSlotStartMs,
  isDropInEvent,
  matchesHourSlot,
} from "./schedule-browse";
import { getNowAndNextEvents } from "./schedule-view";

export type ScheduleRow<T extends BrowseEvent> =
  | { kind: "event"; id: string; event: T }
  | { kind: "agenda"; id: string; event: T; status: AgendaStatus }
  | { kind: "gap"; id: string; gap: AgendaGap }
  | { kind: "dropIn"; id: string; event: T };

export type SectionHeading =
  | { kind: "day"; dayKey: string }
  | { kind: "dropIns" }
  | { kind: "otherOptions"; count: number }
  | { kind: "planDay"; dayKey: string; count: number }
  | { kind: "none" };

export interface ScheduleSection<T extends BrowseEvent> {
  key: string;
  heading: SectionHeading;
  overlapsById: ReadonlyMap<string, OverlapInfo>;
  data: ScheduleRow<T>[];
}

/** Overlap chrome only among saved, still-published, timed events. */
function overlapsFor<T extends BrowseEvent>(
  events: readonly T[],
): ReadonlyMap<string, OverlapInfo> {
  const info = overlapInfoAmong(
    events,
    (event) =>
      event.isInSchedule && event.feedStatus === null && !isDropInEvent(event),
  );
  const byId = new Map<string, OverlapInfo>();
  events.forEach((event, index) => {
    const entry = info[index];
    if (entry && entry.position !== "solo") byId.set(event.id, entry);
  });
  return byId;
}

function groupByDay<T extends BrowseEvent>(
  events: readonly T[],
  timeZone: string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const event of events) {
    const key = conventionDayKey(event.startTime, timeZone);
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }
  return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function buildBrowseSections<T extends BrowseEvent>(
  selection: BrowseSelection<T>,
  filters: Pick<BrowseFilters, "dayKey">,
  timeZone: string,
): ScheduleSection<T>[] {
  const sections: ScheduleSection<T>[] = [];

  if (filters.dayKey === null) {
    for (const [dayKey, events] of groupByDay(selection.rows, timeZone)) {
      sections.push({
        key: `day:${dayKey}`,
        heading: { kind: "day", dayKey },
        overlapsById: overlapsFor(events),
        data: events.map((event) => ({ kind: "event", id: event.id, event })),
      });
    }
  } else if (selection.rows.length > 0) {
    sections.push({
      key: `day:${filters.dayKey}`,
      heading: { kind: "none" },
      overlapsById: overlapsFor(selection.rows),
      data: selection.rows.map((event) => ({
        kind: "event",
        id: event.id,
        event,
      })),
    });
  }

  if (selection.dropIns.length > 0) {
    sections.push({
      key: "drop-ins",
      heading: { kind: "dropIns" },
      overlapsById: new Map(),
      data: selection.dropIns.map((event) => ({
        kind: "dropIn",
        id: event.id,
        event,
      })),
    });
  }

  return sections;
}

export interface AgendaOptions {
  nowMs: number;
  timeZone: string;
  todayKey: string;
}

/**
 * Saved events by day with the gaps between consecutive live, timed ones.
 * A cancelled or drop-in row still shows, but nothing measures a break
 * against it.
 */
export function buildAgendaSections<T extends BrowseEvent>(
  saved: readonly T[],
  dayKey: string | null,
  options: AgendaOptions,
): ScheduleSection<T>[] {
  const valid = saved.filter((event) =>
    Number.isFinite(Date.parse(event.startTime)),
  );
  const onDay =
    dayKey === null
      ? valid
      : valid.filter(
          (event) =>
            conventionDayKey(event.startTime, options.timeZone) === dayKey,
        );

  const sections: ScheduleSection<T>[] = [];
  for (const [key, events] of groupByDay(onDay, options.timeZone)) {
    const ordered = [...events].sort(
      (left, right) =>
        Date.parse(left.startTime) - Date.parse(right.startTime) ||
        left.id.localeCompare(right.id),
    );
    const measurable = (event: T) =>
      event.feedStatus === null && !isDropInEvent(event);
    const rows = buildAgendaRows(ordered, {
      ...options,
      sameGroup: (previous, next) => measurable(previous) && measurable(next),
    }).map<ScheduleRow<T>>((row) =>
      row.kind === "gap"
        ? { kind: "gap", id: row.id, gap: row.gap }
        : { kind: "agenda", id: row.id, event: row.entry, status: row.status },
    );
    sections.push({
      key: `plan:${key}`,
      heading: { kind: "planDay", dayKey: key, count: ordered.length },
      overlapsById: overlapsFor(ordered),
      data: rows,
    });
  }
  return sections;
}

export interface NowHero<T extends BrowseEvent> {
  kind: "current" | "next";
  event: T;
  /** True when the hero starts on a later convention day than today. */
  onAnotherDay: boolean;
  /** Other saved events running right now, after the hero. */
  alsoNow: T[];
  /** The saved event after the hero, when there is one. */
  following: T | null;
  /** The measured relationship between the hero and `following`. */
  gap: AgendaGap | null;
}

export interface NowSelection<T extends BrowseEvent> {
  hero: NowHero<T> | null;
  /** True when today's saved events have all ended. */
  finishedForToday: boolean;
  /** The first saved event on a later convention day, when today is done. */
  nextAnotherDay: T | null;
  sections: ScheduleSection<T>[];
}

/**
 * The Now view's model.
 *
 * The hero is whatever is running; failing that, the next saved event today;
 * failing that, when nothing was saved for today at all, the next saved event
 * on any day (a pre-con evening wants to see tomorrow's first pick). When
 * today's picks have all ended the day is reported finished, with the next
 * day's first pick carried separately so the screen can mention it without
 * pretending the day is still going.
 */
export function buildNowSections<T extends BrowseEvent>(
  all: readonly T[],
  saved: readonly T[],
  nowMs: number,
  timeZone: string,
): NowSelection<T> {
  const live = (event: T) =>
    event.feedStatus === null &&
    !isDropInEvent(event) &&
    Number.isFinite(Date.parse(event.startTime));
  const byStart = (left: T, right: T) =>
    Date.parse(left.startTime) - Date.parse(right.startTime) ||
    left.id.localeCompare(right.id);
  const savedLive = saved.filter(live);
  const { current } = getNowAndNextEvents(savedLive, new Date(nowMs));

  const todayKey = conventionDayKey(new Date(nowMs), timeZone);
  const dayOf = (event: T) => conventionDayKey(event.startTime, timeZone);
  const upcomingAll = savedLive
    .filter((event) => Date.parse(event.startTime) > nowMs)
    .sort(byStart);
  const upcomingToday = upcomingAll.filter(
    (event) => dayOf(event) === todayKey,
  );
  const savedToday = savedLive.filter((event) => dayOf(event) === todayKey);

  let heroEvent: T | null = null;
  let kind: NowHero<T>["kind"] = "next";
  if (current.length > 0) {
    heroEvent = current[0] ?? null;
    kind = "current";
  } else if (upcomingToday.length > 0) {
    heroEvent = upcomingToday[0] ?? null;
  } else if (savedToday.length === 0) {
    heroEvent = upcomingAll[0] ?? null;
  }

  let hero: NowHero<T> | null = null;
  if (heroEvent) {
    const pinned = heroEvent;
    const following =
      upcomingAll.find(
        (event) =>
          event.id !== pinned.id &&
          !current.some((item) => item.id === event.id),
      ) ?? null;
    hero = {
      kind,
      event: pinned,
      onAnotherDay: dayOf(pinned) !== todayKey,
      alsoNow: current.slice(1),
      following,
      gap: following ? describeAgendaGap(pinned, following) : null,
    };
  }

  const finishedForToday = hero === null && savedToday.length > 0;
  const nextAnotherDay = hero === null ? (upcomingAll[0] ?? null) : null;

  const slot = hourSlotStartMs(nowMs, timeZone);
  const options = all
    .filter(
      (event) =>
        !event.isInSchedule &&
        live(event) &&
        matchesHourSlot(event, slot) &&
        (event.endTime
          ? Date.parse(event.endTime) > nowMs
          : Date.parse(event.startTime) + HOUR_MS > nowMs),
    )
    .sort(
      (left, right) =>
        Date.parse(left.startTime) - Date.parse(right.startTime) ||
        left.title.localeCompare(right.title),
    );

  const sections: ScheduleSection<T>[] =
    options.length > 0
      ? [
          {
            key: "other-options",
            heading: { kind: "otherOptions", count: options.length },
            overlapsById: new Map(),
            data: options.map((event) => ({
              kind: "event",
              id: event.id,
              event,
            })),
          },
        ]
      : [];

  return { hero, finishedForToday, nextAnotherDay, sections };
}
