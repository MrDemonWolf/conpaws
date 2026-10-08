/**
 * The rows between saved events on an agenda: how much free time there is,
 * that two panels are back-to-back, or by how much they overlap.
 *
 * The rules are the design exploration's `gap()` (`docs/mobile-ux/app.ts`),
 * with one honesty edit: a gap is a measurement, so an event whose end nobody
 * published gets no gap row at all rather than one invented from a fallback.
 */

import { conventionDayKey } from "./convention-time";

export type AgendaGap =
  | { kind: "free"; minutes: number; hint: "short" | "long" }
  | { kind: "backToBack" }
  | { kind: "overlap"; minutes: number };

export interface AgendaEntryLike {
  id: string;
  startTime: string;
  endTime: string | null;
}

/** An hour or more is long enough to sit down; less is time to walk. */
const LONG_BREAK_MINUTES = 60;

/** Same fallback as the personal schedule: an unknown end counts as an hour. */
const NO_END_FALLBACK_MS = 60 * 60 * 1000;

function parse(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function describeAgendaGap(
  previous: AgendaEntryLike,
  next: AgendaEntryLike,
): AgendaGap | null {
  const previousEnd = parse(previous.endTime);
  const previousStart = parse(previous.startTime);
  const nextStart = parse(next.startTime);
  if (previousEnd === null || previousStart === null || nextStart === null)
    return null;
  if (previousEnd <= previousStart) return null;

  const minutes = Math.round((nextStart - previousEnd) / 60_000);
  if (minutes > 0) {
    return {
      kind: "free",
      minutes,
      hint: minutes >= LONG_BREAK_MINUTES ? "long" : "short",
    };
  }
  if (minutes === 0) return { kind: "backToBack" };

  // The overlap is the intersection, never the raw difference: a short panel
  // inside a long one overlaps by its own length, not by how late it started.
  const nextEnd = parse(next.endTime) ?? nextStart + NO_END_FALLBACK_MS;
  const overlap = Math.round(
    (Math.min(previousEnd, nextEnd) - nextStart) / 60_000,
  );
  return { kind: "overlap", minutes: Math.max(overlap, 1) };
}

export function splitMinutes(total: number): {
  hours: number;
  minutes: number;
} {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

export type AgendaStatus = "now" | "endedToday" | "ended" | "upcoming";

export function agendaStatus(
  entry: AgendaEntryLike,
  nowMs: number,
  timeZone: string,
  todayKey: string,
): AgendaStatus {
  const start = parse(entry.startTime);
  if (start === null) return "upcoming";
  const end = parse(entry.endTime);
  const effectiveEnd =
    end !== null && end > start ? end : start + NO_END_FALLBACK_MS;

  if (nowMs >= effectiveEnd) {
    return conventionDayKey(entry.startTime, timeZone) === todayKey
      ? "endedToday"
      : "ended";
  }
  if (nowMs >= start) return "now";
  return "upcoming";
}

export type AgendaRowItem<T extends AgendaEntryLike> =
  | { kind: "agenda"; id: string; entry: T; status: AgendaStatus }
  | { kind: "gap"; id: string; gap: AgendaGap };

export interface BuildAgendaRowsOptions<T> {
  nowMs: number;
  timeZone: string;
  todayKey: string;
  /**
   * Whether two consecutive entries can have a gap row between them. The
   * pooled Schedule tab passes "same convention": the walk between two cons
   * is not a break.
   */
  sameGroup?: (previous: T, next: T) => boolean;
}

/**
 * Entries in display order, with a gap row inserted after each one that has a
 * measurable relationship to the next. Row ids are stable so a windowed list
 * can key on them.
 */
export function buildAgendaRows<T extends AgendaEntryLike>(
  entries: readonly T[],
  options: BuildAgendaRowsOptions<T>,
): AgendaRowItem<T>[] {
  const rows: AgendaRowItem<T>[] = [];
  entries.forEach((entry, index) => {
    rows.push({
      kind: "agenda",
      id: entry.id,
      entry,
      status: agendaStatus(
        entry,
        options.nowMs,
        options.timeZone,
        options.todayKey,
      ),
    });

    const next = entries[index + 1];
    if (!next) return;
    if (options.sameGroup && !options.sameGroup(entry, next)) return;

    const gap = describeAgendaGap(entry, next);
    if (gap) rows.push({ kind: "gap", id: `gap:${entry.id}:${next.id}`, gap });
  });
  return rows;
}
