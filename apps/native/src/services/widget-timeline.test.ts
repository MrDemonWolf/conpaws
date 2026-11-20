import { describe, expect, it } from "vitest";
import type { WidgetEventSnapshot, WidgetSnapshot } from "./widget-snapshot";
import {
  buildStoredWidgetProps,
  buildStoredWidgetTimeline,
  buildWidgetTimeline,
} from "./widget-timeline";

const now = Date.parse("2026-11-16T12:00:00Z");
const minute = 60_000;
const hour = 60 * minute;

function event(
  index: number,
  start = now + (index + 1) * hour,
): WidgetEventSnapshot {
  return {
    id: `event-${index}`,
    title: `Panel ${index}`,
    startAtMs: start,
    endAtMs: start + hour,
    reminderMinutes: 15,
    location: null,
    room: null,
    ageRating: null,
  };
}

function snapshot(events: WidgetEventSnapshot[] = []): WidgetSnapshot {
  return {
    schemaVersion: 2,
    generatedAtMs: now,
    localeIdentifier: "en",
    timeFormat: "24",
    conventions: [
      {
        id: "con",
        name: "Con",
        startAtMs: now - hour,
        endAtMs: now + 72 * hour,
        timeZoneIdentifier: "America/Chicago",
        dateRangeLabel: "November 16–18",
        events,
      },
    ],
  };
}

describe("Expo widget timeline", () => {
  it("includes reminder minutes, starts, ends and stale time without duplicate dates", () => {
    const panel = event(0, now + 10 * minute);
    const timeline = buildWidgetTimeline(snapshot([panel]));
    const dates = timeline.map(({ date }) => date.getTime());
    expect(dates).toContain(now + minute);
    expect(dates).toContain(panel.startAtMs);
    expect(dates).toContain(panel.endAtMs);
    expect(dates).toContain(now + 30 * minute);
    expect(dates).toEqual([...new Set(dates)].sort((a, b) => a - b));
    expect(timeline.at(-1)).toMatchObject({
      date: new Date(now + 48 * hour),
      props: { expired: true, snapshot: { conventions: [] } },
    });
  });

  it("retains original counts while trimming repeated event history", () => {
    const input = snapshot(
      Array.from({ length: 20 }, (_, index) => event(index)),
    );
    const timeline = buildWidgetTimeline(input);
    const first = timeline[0]?.props.snapshot.conventions[0];
    expect(first?.events).toHaveLength(4);
    expect(first?.eventCount).toBe(20);
    expect(first?.remainingTodayCount).toBeGreaterThan(4);
    expect(input.conventions[0]?.events).toHaveLength(20);
  });

  it("expires safely at the first omitted boundary when a dense plan reaches its budget", () => {
    const input = snapshot(
      Array.from({ length: 1000 }, (_, index) =>
        event(index, now + (index + 1) * minute),
      ),
    );
    const timeline = buildWidgetTimeline(input);
    expect(timeline.length).toBeLessThanOrEqual(256);
    expect(timeline.at(-1)?.props.expired).toBe(true);
    expect(timeline.at(-1)?.date.getTime()).toBeLessThan(now + 48 * hour);
    expect(timeline.at(-1)?.props.snapshot.conventions).toEqual([]);
  });

  it.each([15, 30])(
    "keeps the full 48 h for a con plan of 8 panels a day with %i-minute reminders",
    (reminderMinutes) => {
      // Minute-by-minute reminder counts used to spend the entry budget, so an
      // ordinary con day fell back to the refresh state after about 11 hours.
      const events = [0, 1, 2].flatMap((day) =>
        Array.from({ length: 8 }, (_, slot) => ({
          ...event(
            day * 8 + slot,
            now + hour + day * 24 * hour + slot * 90 * minute,
          ),
          reminderMinutes,
        })),
      );
      const timeline = buildWidgetTimeline(snapshot(events));
      const dates = timeline.map(({ date }) => date.getTime());
      expect(timeline.length).toBeLessThanOrEqual(256);
      expect(timeline.at(-1)?.date.getTime()).toBe(now + 48 * hour);
      expect(timeline.at(-1)?.props.expired).toBe(true);
      for (const panel of events.filter(
        ({ startAtMs }) => startAtMs < now + 48 * hour,
      )) {
        expect(dates).toContain(panel.startAtMs);
        expect(dates).toContain(panel.endAtMs);
        expect(dates).toContain(panel.startAtMs - reminderMinutes * minute);
      }
      // The nearest reminder still counts down a minute at a time.
      const first = events[0];
      for (let left = 1; left < reminderMinutes; left++)
        expect(dates).toContain(first.startAtMs - left * minute);
      expect(dates).toEqual([...new Set(dates)].sort((a, b) => a - b));
    },
  );

  it("adds convention-local midnight across the spring DST transition", () => {
    const input = snapshot();
    input.generatedAtMs = Date.parse("2026-03-08T06:30:00Z");
    const dates = buildWidgetTimeline(input).map(({ date }) =>
      date.toISOString(),
    );
    expect(dates).toContain("2026-03-09T05:00:00.000Z");
  });

  it("stores a timeline iOS accepts: no null field anywhere", () => {
    function hasNull(value: unknown): boolean {
      if (value === null || value === undefined) return true;
      if (value instanceof Date || typeof value !== "object") return false;
      return Object.values(value).some(hasNull);
    }
    const open = { ...event(0), endAtMs: null, reminderMinutes: null };
    expect(hasNull(buildWidgetTimeline(snapshot([open])))).toBe(true);

    const stored = buildStoredWidgetTimeline(snapshot([open]));
    expect(hasNull(stored)).toBe(false);
    expect(stored).toHaveLength(buildWidgetTimeline(snapshot([open])).length);
    expect(stored[0].date).toBeInstanceOf(Date);
    expect(stored[0].props.snapshot.conventions[0].events[0]).toEqual({
      id: "event-0",
      title: "Panel 0",
      startAtMs: open.startAtMs,
    });
    expect(stored.at(-1)?.props.expired).toBe(true);
  });

  it("hands Android a snapshot its bridge accepts: no null field anywhere", () => {
    // Expo's Android bridge refuses the whole props object over one null,
    // which left the launcher widget on whatever it was last given.
    function hasNull(value: unknown): boolean {
      if (value === null || value === undefined) return true;
      if (typeof value !== "object") return false;
      return Object.values(value).some(hasNull);
    }
    const open = { ...event(0), endAtMs: null, reminderMinutes: null };
    const stored = buildStoredWidgetProps(snapshot([open]));
    expect(hasNull(stored)).toBe(false);
    expect(stored.snapshot.conventions[0].events[0]).toEqual({
      id: "event-0",
      title: "Panel 0",
      startAtMs: open.startAtMs,
    });
    expect(stored.snapshot.generatedAtMs).toBe(now);
  });
});
