import { describe, expect, it } from "vitest";
import type { BrowseEvent } from "./schedule-browse";
import { selectBrowseEvents } from "./schedule-browse";
import {
  buildAgendaSections,
  buildBrowseSections,
  buildNowSections,
} from "./schedule-sections";

const TZ = "America/New_York";

function at(day: number, hour: number, minute = 0): string {
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

const photo = event("photo", at(19, 14), at(19, 15), { isInSchedule: true });
const draw = event("draw", at(19, 14, 35), at(19, 15, 30), {
  isInSchedule: true,
});
const first = event("first", at(19, 14, 30), at(19, 15, 30));
const story = event("story", at(19, 16), at(19, 17), { isInSchedule: true });
const market = event("market", at(19, 10), at(19, 18), { isInSchedule: true });
const welcome = event("welcome", at(18, 14), at(18, 15), {
  isInSchedule: true,
});
const farewell = event("farewell", at(20, 14), at(20, 15), {
  isInSchedule: true,
});
const gone = event("gone", at(19, 15, 45), at(19, 16, 30), {
  isInSchedule: true,
  feedStatus: "cancelled",
});
const all = [photo, draw, first, story, market, welcome, farewell, gone];

describe("buildBrowseSections", () => {
  it("makes one section per day in all-days mode, plus drop-ins", () => {
    const selection = selectBrowseEvents(
      all,
      { dayKey: null, slotStartMs: null, category: null, query: "" },
      TZ,
    );
    const sections = buildBrowseSections(selection, { dayKey: null }, TZ);
    expect(sections.map((section) => section.key)).toEqual([
      "day:2026-09-18",
      "day:2026-09-19",
      "day:2026-09-20",
      "drop-ins",
    ]);
    expect(sections[1]?.data.map((row) => row.id)).toEqual([
      "photo",
      "first",
      "draw",
      "gone",
      "story",
    ]);
    expect(sections[3]?.data[0]).toMatchObject({
      kind: "dropIn",
      id: "market",
    });
  });

  it("makes a single unlabelled section for one day", () => {
    const selection = selectBrowseEvents(
      all,
      { dayKey: "2026-09-18", slotStartMs: null, category: null, query: "" },
      TZ,
    );
    const sections = buildBrowseSections(
      selection,
      { dayKey: "2026-09-18" },
      TZ,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0]?.heading).toEqual({ kind: "none" });
  });

  it("keys overlap chrome by id, among saved live events only", () => {
    const selection = selectBrowseEvents(
      all,
      { dayKey: "2026-09-19", slotStartMs: null, category: null, query: "" },
      TZ,
    );
    const [section] = buildBrowseSections(
      selection,
      { dayKey: "2026-09-19" },
      TZ,
    );
    expect(section?.overlapsById.get("photo")?.position).toBe("first");
    expect(section?.overlapsById.get("draw")?.position).toBe("last");
    expect(section?.overlapsById.has("first")).toBe(false);
    expect(section?.overlapsById.has("gone")).toBe(false);
  });
});

describe("buildAgendaSections", () => {
  const options = {
    nowMs: Date.parse(at(19, 14, 18)),
    timeZone: TZ,
    todayKey: "2026-09-19",
  };

  it("groups saved events by day with gap rows between measurable ones", () => {
    const saved = all.filter((item) => item.isInSchedule);
    const sections = buildAgendaSections(saved, null, options);
    expect(sections.map((section) => section.key)).toEqual([
      "plan:2026-09-18",
      "plan:2026-09-19",
      "plan:2026-09-20",
    ]);
    const saturday = sections[1];
    expect(saturday?.heading).toEqual({
      kind: "planDay",
      dayKey: "2026-09-19",
      count: 5,
    });
    expect(saturday?.data.map((row) => row.id)).toEqual([
      "market",
      "photo",
      "gap:photo:draw",
      "draw",
      "gone",
      "story",
    ]);
  });

  it("filters to one day", () => {
    const saved = all.filter((item) => item.isInSchedule);
    const sections = buildAgendaSections(saved, "2026-09-20", options);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.data.map((row) => row.id)).toEqual(["farewell"]);
  });
});

describe("buildNowSections", () => {
  it("leads with the current saved event and the one after it", () => {
    const now = buildNowSections(
      all,
      all.filter((item) => item.isInSchedule),
      Date.parse(at(19, 14, 18)),
      TZ,
    );
    expect(now.hero?.kind).toBe("current");
    expect(now.hero?.event.id).toBe("photo");
    expect(now.hero?.following?.id).toBe("draw");
    expect(now.hero?.gap).toEqual({ kind: "overlap", minutes: 25 });
    expect(now.finishedForToday).toBe(false);
    expect(now.sections[0]?.heading).toEqual({
      kind: "otherOptions",
      count: 1,
    });
    expect(now.sections[0]?.data.map((row) => row.id)).toEqual(["first"]);
  });

  it("falls back to the next saved event between panels", () => {
    const now = buildNowSections(
      all,
      all.filter((item) => item.isInSchedule),
      Date.parse(at(19, 15, 35)),
      TZ,
    );
    expect(now.hero?.kind).toBe("next");
    expect(now.hero?.event.id).toBe("story");
    expect(now.hero?.onAnotherDay).toBe(false);
    expect(now.hero?.following?.id).toBe("farewell");
  });

  it("shows tomorrow's first pick when nothing was saved for today", () => {
    const now = buildNowSections(
      [farewell],
      [farewell],
      Date.parse(at(19, 21, 30)),
      TZ,
    );
    expect(now.hero?.kind).toBe("next");
    expect(now.hero?.event.id).toBe("farewell");
    expect(now.hero?.onAnotherDay).toBe(true);
    expect(now.finishedForToday).toBe(false);
  });

  it("reports the day as finished once every saved event has ended", () => {
    const now = buildNowSections(
      all,
      all.filter((item) => item.isInSchedule),
      Date.parse(at(19, 21, 30)),
      TZ,
    );
    expect(now.hero).toBeNull();
    expect(now.finishedForToday).toBe(true);
    expect(now.nextAnotherDay?.id).toBe("farewell");
  });

  it("has no hero and no finished state when nothing is saved", () => {
    const now = buildNowSections(all, [], Date.parse(at(19, 14, 18)), TZ);
    expect(now.hero).toBeNull();
    expect(now.finishedForToday).toBe(false);
    expect(now.nextAnotherDay).toBeNull();
  });

  it("keeps the last running event as the hero with nothing following", () => {
    const now = buildNowSections(
      [story],
      [story],
      Date.parse(at(19, 16, 20)),
      TZ,
    );
    expect(now.hero?.kind).toBe("current");
    expect(now.hero?.following).toBeNull();
    expect(now.hero?.gap).toBeNull();
  });
});
