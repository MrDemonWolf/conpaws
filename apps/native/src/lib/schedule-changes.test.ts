import { describe, expect, it } from "vitest";
import {
  hasSavedChanges,
  type ScheduleOccurrence,
  summarizeScheduleChanges,
} from "./schedule-changes";

function occurrence(
  overrides: Partial<ScheduleOccurrence> = {},
): ScheduleOccurrence {
  return {
    sourceUid: "panel-1",
    startTime: "2026-09-03T20:00:00.000Z",
    endTime: "2026-09-03T21:00:00.000Z",
    room: "Room A",
    location: "Main Hall",
    isInSchedule: false,
    ...overrides,
  };
}

/** A feed of n events with predictable uids, for the ratio guards. */
function feedOf(count: number, from = 0): ScheduleOccurrence[] {
  return Array.from({ length: count }, (_, index) =>
    occurrence({ sourceUid: `panel-${from + index}` }),
  );
}

describe("summarizeScheduleChanges", () => {
  it("says nothing about a convention whose events were all added by hand", () => {
    const outcome = summarizeScheduleChanges(
      [occurrence({ sourceUid: null }), occurrence({ sourceUid: null })],
      [occurrence()],
      [],
    );

    expect(outcome).toEqual({ status: "unchanged" });
  });

  it("reports no change when the feed matches what was imported", () => {
    const stored = [occurrence(), occurrence({ sourceUid: "panel-2" })];

    const outcome = summarizeScheduleChanges(stored, stored, []);

    // The test that stops a permanent notice: both feed generators rewrite
    // DTSTAMP on every request, so an identical schedule must still compare
    // equal.
    expect(outcome).toEqual({ status: "unchanged" });
  });

  it("counts a moved time, a moved room, and a changed end time", () => {
    const stored = [
      occurrence({ sourceUid: "time" }),
      occurrence({ sourceUid: "room" }),
      occurrence({ sourceUid: "end" }),
      occurrence({ sourceUid: "same" }),
    ];
    const feed = [
      occurrence({ sourceUid: "time", startTime: "2026-09-03T22:00:00.000Z" }),
      occurrence({ sourceUid: "room", room: "Room B" }),
      occurrence({ sourceUid: "end", endTime: "2026-09-03T22:30:00.000Z" }),
      occurrence({ sourceUid: "same" }),
    ];

    const outcome = summarizeScheduleChanges(stored, feed, []);

    expect(outcome).toEqual({
      status: "changed",
      summary: {
        moved: 3,
        gone: 0,
        savedMoved: 0,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("ignores a retitled panel", () => {
    // Titles are not part of the comparison at all, so a feed that only fixed
    // its wording must read as unchanged. Organizers do this constantly.
    const stored = [occurrence(), occurrence({ sourceUid: "panel-2" })];
    const feed = [occurrence(), occurrence({ sourceUid: "panel-2" })];

    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "unchanged",
    });
  });

  it("separates saved events from the rest", () => {
    const stored = [
      occurrence({ sourceUid: "saved-move", isInSchedule: true }),
      occurrence({ sourceUid: "saved-gone", isInSchedule: true }),
      occurrence({ sourceUid: "other-move" }),
      ...feedOf(10, 100),
    ];
    const feed = [
      occurrence({ sourceUid: "saved-move", room: "Room Z" }),
      occurrence({ sourceUid: "other-move", room: "Room Y" }),
      ...feedOf(10, 100),
    ];

    const outcome = summarizeScheduleChanges(stored, feed, []);

    expect(outcome).toEqual({
      status: "changed",
      summary: {
        moved: 2,
        gone: 1,
        savedMoved: 1,
        savedGone: 1,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("counts an announced cancellation as gone", () => {
    const stored = [
      occurrence({ sourceUid: "cancelled", isInSchedule: true }),
      ...feedOf(10, 100),
    ];
    const feed = feedOf(10, 100);

    const outcome = summarizeScheduleChanges(stored, feed, ["cancelled"]);

    expect(outcome).toEqual({
      status: "changed",
      summary: {
        moved: 0,
        gone: 1,
        savedMoved: 0,
        savedGone: 1,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("does not recount stored tombstones as gone and reports a reappearance as moved", () => {
    const gone = occurrence({ sourceUid: "gone", feedStatus: "removed" });
    const reappeared = occurrence({
      sourceUid: "back",
      feedStatus: "cancelled",
      isInSchedule: true,
    });
    const filler = feedOf(10, 100);
    expect(summarizeScheduleChanges([gone, ...filler], filler, [])).toEqual({
      status: "unchanged",
    });
    expect(
      summarizeScheduleChanges(
        [reappeared, ...filler],
        [occurrence({ sourceUid: "back" }), ...filler],
        [],
      ),
    ).toEqual({
      status: "changed",
      summary: {
        moved: 1,
        gone: 0,
        savedMoved: 1,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("stays silent on an empty feed rather than reporting a wipe", () => {
    const outcome = summarizeScheduleChanges(feedOf(20), [], []);

    expect(outcome).toEqual({ status: "untrusted", reason: "empty-feed" });
  });

  it("stays silent when not one stored event appears in the feed", () => {
    // A rewritten identifier scheme, or the wrong feed behind a redirect.
    // Reading this as a mass cancellation is the single worst thing the
    // feature could do, so it is the most important case in this file.
    const outcome = summarizeScheduleChanges(feedOf(20), feedOf(20, 500), []);

    expect(outcome).toEqual({ status: "untrusted", reason: "no-overlap" });
  });

  it("stays silent when more than a fifth of the schedule disappears", () => {
    const stored = feedOf(20);
    const feed = feedOf(15);

    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "untrusted",
      reason: "mass-removal",
    });
  });

  it("applies a fifth-of-the-schedule loss right up to the threshold", () => {
    const stored = feedOf(20);
    const feed = feedOf(16);

    // Exactly 20% is allowed through; the guard is for feeds that are clearly
    // broken, not for a convention trimming its programme.
    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "changed",
      summary: {
        moved: 0,
        gone: 4,
        savedMoved: 0,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("stays silent when many saved events go at once on a large schedule", () => {
    const saved = Array.from({ length: 11 }, (_, index) =>
      occurrence({ sourceUid: `saved-${index}`, isInSchedule: true }),
    );
    const stored = [...saved, ...feedOf(200, 100)];
    const feed = feedOf(200, 100);

    // The ratio guard alone would wave this through at 5%, but eleven saved
    // panels vanishing at once is not something to apply quietly.
    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "untrusted",
      reason: "mass-removal",
    });
  });

  it("does not report events the feed has gained", () => {
    const stored = feedOf(10);
    const feed = [...feedOf(10), ...feedOf(5, 900)];

    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "unchanged",
    });
  });

  it("matches rows an earlier build filed under an alarm's UID", () => {
    // Apple exports give each VALARM its own UID, which earlier builds kept in
    // place of the event's. Every stored row is keyed that way, so without the
    // previous identity nothing overlaps and the feed is never applied again.
    const stored = [
      occurrence({ sourceUid: "alarm-a", isInSchedule: true }),
      occurrence({ sourceUid: "alarm-b", isInSchedule: true }),
    ];
    const feed = [
      occurrence({ sourceUid: "event-a", previousSourceUid: "alarm-a" }),
      occurrence({
        sourceUid: "event-b",
        previousSourceUid: "alarm-b",
        room: "Room B",
      }),
    ];

    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "changed",
      summary: {
        moved: 1,
        gone: 0,
        savedMoved: 1,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("leaves a previous identity alone once a row holds the current one", () => {
    // A file re-import already added the event under its own UID, so the old
    // row is a leftover, not this event.
    const stored = [
      occurrence({ sourceUid: "alarm-a", isInSchedule: true }),
      occurrence({ sourceUid: "event-a" }),
      ...feedOf(10, 100),
    ];
    const feed = [
      occurrence({ sourceUid: "event-a", previousSourceUid: "alarm-a" }),
      ...feedOf(10, 100),
    ];

    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "changed",
      summary: {
        moved: 0,
        gone: 1,
        savedMoved: 0,
        savedGone: 1,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("does not call an all-day event that gained its span moved", () => {
    // Earlier builds stored every all-day event with no end. The feed did not
    // change; ConPaws now reads the whole day, which files it as a drop-in.
    const stored = [
      occurrence({
        sourceUid: "costume-day",
        startTime: "2026-09-05T05:00:00.000Z",
        endTime: null,
        isInSchedule: true,
      }),
      occurrence({
        sourceUid: "art-show",
        startTime: "2026-09-05T05:00:00.000Z",
        endTime: null,
      }),
      occurrence({ sourceUid: "panel-2" }),
    ];
    const feed = [
      occurrence({
        sourceUid: "costume-day",
        startTime: "2026-09-05T05:00:00.000Z",
        endTime: "2026-09-06T05:00:00.000Z",
        isAllDay: true,
      }),
      occurrence({
        sourceUid: "art-show",
        startTime: "2026-09-05T05:00:00.000Z",
        endTime: "2026-09-06T05:00:00.000Z",
        isAllDay: true,
      }),
      occurrence({ sourceUid: "panel-2" }),
    ];

    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "changed",
      summary: {
        moved: 0,
        gone: 0,
        savedMoved: 0,
        savedGone: 0,
        nowDropIn: 2,
        savedNowDropIn: 1,
      },
    });
  });

  it("still counts an all-day event that also moved as moved", () => {
    const stored = [
      occurrence({
        sourceUid: "costume-day",
        startTime: "2026-09-05T05:00:00.000Z",
        endTime: null,
        isInSchedule: true,
      }),
    ];
    const feed = [
      occurrence({
        sourceUid: "costume-day",
        startTime: "2026-09-06T05:00:00.000Z",
        endTime: "2026-09-07T05:00:00.000Z",
        isAllDay: true,
      }),
    ];

    expect(summarizeScheduleChanges(stored, feed, [])).toEqual({
      status: "changed",
      summary: {
        moved: 1,
        gone: 0,
        savedMoved: 1,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
  });

  it("never lets a hand-added event look like a removal", () => {
    const stored = [
      ...feedOf(10),
      occurrence({ sourceUid: null, isInSchedule: true }),
    ];

    expect(summarizeScheduleChanges(stored, feedOf(10), [])).toEqual({
      status: "unchanged",
    });
  });
});

describe("hasSavedChanges", () => {
  const nothing = {
    moved: 0,
    gone: 0,
    savedMoved: 0,
    savedGone: 0,
    nowDropIn: 0,
    savedNowDropIn: 0,
  };

  it("is true only when something the user saved is affected", () => {
    expect(
      hasSavedChanges({ ...nothing, moved: 9, gone: 3, nowDropIn: 2 }),
    ).toBe(false);
    expect(hasSavedChanges({ ...nothing, moved: 1, savedMoved: 1 })).toBe(true);
    expect(hasSavedChanges({ ...nothing, gone: 1, savedGone: 1 })).toBe(true);
  });

  it("is true for a saved all-day event that is now a drop-in", () => {
    // It has left the user's plan until they pick a visit, so they are told.
    expect(
      hasSavedChanges({ ...nothing, nowDropIn: 1, savedNowDropIn: 1 }),
    ).toBe(true);
  });
});
