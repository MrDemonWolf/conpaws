import { describe, expect, it } from "vitest";
import {
  type BrowseEvent,
  browseStateForEvent,
  conflictingSavedIds,
  conventionDayKeys,
  dayCounts,
  defaultBrowseDay,
  hourSlotStartMs,
  hourSlotsFor,
  isDropInEvent,
  matchesHourSlot,
  normalizeSearchQuery,
  selectBrowseEvents,
} from "./schedule-browse";

const TZ = "America/New_York";

/** `2026-09-19` is a Saturday; the con runs Friday 18th to Sunday 20th. */
function at(day: number, hour: number, minute = 0): string {
  // September 2026 is EDT (UTC-4).
  return new Date(Date.UTC(2026, 8, day, hour + 4, minute, 0)).toISOString();
}

function event(
  id: string,
  start: string,
  end: string | null,
  overrides: Partial<BrowseEvent> = {},
): BrowseEvent {
  return {
    id,
    title: id,
    startTime: start,
    endTime: end,
    room: null,
    location: null,
    category: null,
    description: null,
    isInSchedule: false,
    feedStatus: null,
    ...overrides,
  };
}

const photo = event("photo", at(19, 14), at(19, 15), {
  room: "Ballroom A",
  category: "Fursuiting",
  isInSchedule: true,
});
const draw = event("draw", at(19, 14), at(19, 15, 30), {
  room: "Cedar",
  category: "Art",
  isInSchedule: true,
  description: "Sketch along with Milo.",
});
const first = event("first", at(19, 14, 30), at(19, 15, 30), {
  room: "Maple",
  category: "Fursuiting",
});
const makers = event("makers", at(19, 11), at(19, 12), {
  room: "Ballroom A",
  category: "Community",
});
const story = event("story", at(19, 16), at(19, 17), {
  room: "Cedar",
  category: "Writing",
});
const market = event("market", at(19, 10), at(19, 18), {
  room: "Exhibit Hall",
  category: "Art",
});
const welcome = event("welcome", at(18, 14), at(18, 15), {
  room: "Ballroom A",
  category: "Community",
});
const farewell = event("farewell", at(20, 14), at(20, 15), {
  room: "Ballroom A",
  category: "Community",
});
const panels = [photo, draw, first, makers, story, market, welcome, farewell];

describe("isDropInEvent", () => {
  it("treats four hours or longer as drop-in programming", () => {
    expect(isDropInEvent(event("a", at(19, 10), at(19, 13, 59)))).toBe(false);
    expect(isDropInEvent(event("b", at(19, 10), at(19, 14)))).toBe(true);
  });

  it("never guesses from a missing end time", () => {
    expect(isDropInEvent(event("c", at(19, 10), null))).toBe(false);
  });
});

describe("conventionDayKeys", () => {
  it("lists the convention days inclusively", () => {
    expect(conventionDayKeys("2026-09-18", "2026-09-20", [], TZ)).toEqual([
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });

  it("adds a day an event falls on outside the range, once", () => {
    const early = event("early", at(17, 20), at(17, 22));
    expect(
      conventionDayKeys("2026-09-18", "2026-09-20", [early, early], TZ),
    ).toEqual(["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
  });

  it("keys days in the convention zone, not UTC", () => {
    // 11 PM in New York is 3 AM UTC the next day.
    const late = event("late", at(19, 23), at(19, 23, 30));
    expect(conventionDayKeys("2026-09-19", "2026-09-19", [late], TZ)).toEqual([
      "2026-09-19",
    ]);
  });
});

describe("dayCounts and defaultBrowseDay", () => {
  it("counts timed events per day and ignores drop-ins", () => {
    const counts = dayCounts(panels, TZ);
    expect(counts.get("2026-09-18")).toBe(1);
    expect(counts.get("2026-09-19")).toBe(5);
    expect(counts.get("2026-09-20")).toBe(1);
  });

  it("opens on today during the convention", () => {
    const keys = ["2026-09-18", "2026-09-19", "2026-09-20"];
    expect(defaultBrowseDay(keys, dayCounts(panels, TZ), "2026-09-19")).toBe(
      "2026-09-19",
    );
  });

  it("opens on the first day with events before the convention", () => {
    const keys = ["2026-09-18", "2026-09-19", "2026-09-20"];
    const counts = new Map([["2026-09-19", 3]]);
    expect(defaultBrowseDay(keys, counts, "2026-09-03")).toBe("2026-09-19");
    expect(defaultBrowseDay(keys, new Map(), "2026-09-03")).toBe("2026-09-18");
    expect(defaultBrowseDay([], new Map(), "2026-09-03")).toBeNull();
  });
});

describe("hour slots", () => {
  it("floors an instant to its convention-local hour", () => {
    expect(hourSlotStartMs(at(19, 14, 25), TZ)).toBe(Date.parse(at(19, 14)));
  });

  it("lists the distinct start hours of a day, in order", () => {
    expect(hourSlotsFor(panels, "2026-09-19", TZ)).toEqual([
      Date.parse(at(19, 11)),
      Date.parse(at(19, 14)),
      Date.parse(at(19, 16)),
    ]);
  });

  it("spans every day when no day is selected and skips drop-ins", () => {
    expect(hourSlotsFor(panels, null, TZ)).toEqual([
      Date.parse(at(18, 14)),
      Date.parse(at(19, 11)),
      Date.parse(at(19, 14)),
      Date.parse(at(19, 16)),
      Date.parse(at(20, 14)),
    ]);
  });

  it("matches an event to an hour if any part of it runs then", () => {
    const two = Date.parse(at(19, 14));
    const three = Date.parse(at(19, 15));
    expect(matchesHourSlot(photo, two)).toBe(true);
    expect(matchesHourSlot(photo, three)).toBe(false);
    expect(matchesHourSlot(first, two)).toBe(true);
    expect(matchesHourSlot(first, three)).toBe(true);
    expect(matchesHourSlot(makers, two)).toBe(false);
  });

  it("gives an event with no end an hour to live in", () => {
    const open = event("open", at(19, 14, 30), null);
    expect(matchesHourSlot(open, Date.parse(at(19, 15)))).toBe(true);
    expect(matchesHourSlot(open, Date.parse(at(19, 16)))).toBe(false);
  });
});

describe("selectBrowseEvents", () => {
  const all = { dayKey: null, slotStartMs: null, category: null, query: "" };

  it("keeps every day when no day is selected, drop-ins aside", () => {
    const result = selectBrowseEvents(panels, all, TZ);
    expect(result.rows.map((row) => row.id)).toEqual([
      "welcome",
      "makers",
      "photo",
      "draw",
      "first",
      "story",
      "farewell",
    ]);
    expect(result.dropIns.map((row) => row.id)).toEqual(["market"]);
    expect(result.total).toBe(7);
    expect(result.dayCount).toBe(3);
  });

  it("filters to one day", () => {
    const result = selectBrowseEvents(
      panels,
      { ...all, dayKey: "2026-09-18" },
      TZ,
    );
    expect(result.rows.map((row) => row.id)).toEqual(["welcome"]);
    expect(result.dropIns).toEqual([]);
  });

  it("filters to an hour across days", () => {
    const result = selectBrowseEvents(
      panels,
      { ...all, slotStartMs: Date.parse(at(19, 14)) },
      TZ,
    );
    expect(result.rows.map((row) => row.id)).toEqual([
      "photo",
      "draw",
      "first",
    ]);
  });

  it("combines category and a trimmed, case-insensitive search", () => {
    const result = selectBrowseEvents(
      panels,
      { ...all, category: "Art", query: "  CEDAR " },
      TZ,
    );
    expect(result.rows.map((row) => row.id)).toEqual(["draw"]);
  });

  it("counts the total before category and search apply", () => {
    const result = selectBrowseEvents(
      panels,
      {
        dayKey: "2026-09-19",
        slotStartMs: Date.parse(at(19, 14)),
        category: "Art",
        query: "",
      },
      TZ,
    );
    expect(result.rows.map((row) => row.id)).toEqual(["draw"]);
    expect(result.total).toBe(3);
  });

  it("searches descriptions and rooms", () => {
    expect(
      selectBrowseEvents(panels, { ...all, query: "milo" }, TZ).rows.map(
        (row) => row.id,
      ),
    ).toEqual(["draw"]);
    expect(
      selectBrowseEvents(panels, { ...all, query: "exhibit" }, TZ).dropIns.map(
        (row) => row.id,
      ),
    ).toEqual(["market"]);
  });

  it("orders rows by start, then room, then title", () => {
    const result = selectBrowseEvents(
      panels,
      { ...all, dayKey: "2026-09-19" },
      TZ,
    );
    expect(result.rows.map((row) => row.id)).toEqual([
      "makers",
      "photo",
      "draw",
      "first",
      "story",
    ]);
  });

  it("drops events with an unparseable start", () => {
    const broken = event("broken", "not a date", null);
    expect(selectBrowseEvents([broken, photo], all, TZ).rows).toHaveLength(1);
  });
});

describe("conflictingSavedIds", () => {
  it("flags only saved, live, timed events that overlap", () => {
    const conflicts = conflictingSavedIds([
      photo,
      draw,
      first,
      { ...market, isInSchedule: true },
      { ...story, isInSchedule: true },
      { ...farewell, isInSchedule: true, feedStatus: "cancelled" },
      { ...welcome, isInSchedule: true },
    ]);
    expect([...conflicts].sort()).toEqual(["draw", "photo"]);
  });
});

describe("helpers", () => {
  it("normalises a query", () => {
    expect(normalizeSearchQuery("  Cedar ")).toBe("cedar");
  });

  it("describes the browse state that shows an event", () => {
    expect(browseStateForEvent(photo, TZ)).toEqual({
      dayKey: "2026-09-19",
      slotStartMs: null,
      category: null,
    });
  });
});
