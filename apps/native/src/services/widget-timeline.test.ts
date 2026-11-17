import { describe, expect, it } from "vitest";
import type { WidgetEventSnapshot, WidgetSnapshot } from "./widget-snapshot";
import { buildWidgetTimeline } from "./widget-timeline";

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

  it("adds convention-local midnight across the spring DST transition", () => {
    const input = snapshot();
    input.generatedAtMs = Date.parse("2026-03-08T06:30:00Z");
    const dates = buildWidgetTimeline(input).map(({ date }) =>
      date.toISOString(),
    );
    expect(dates).toContain("2026-03-09T05:00:00.000Z");
  });
});
