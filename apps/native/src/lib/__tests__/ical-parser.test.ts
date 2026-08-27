import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIcs, UnsupportedRecurrenceError } from "../ical-parser";

const SMALL_ICS_PATH = path.resolve(
  __dirname,
  "../../../../../test-data/small-test.ics",
);

function loadSmallIcs(): string {
  return fs.readFileSync(SMALL_ICS_PATH, "utf-8");
}

describe("parseIcs", () => {
  it("returns empty result for empty input", () => {
    const result = parseIcs("");
    expect(result.events).toHaveLength(0);
    expect(result.cancelledSourceUids).toEqual([]);
    expect(result.categories).toHaveLength(0);
    expect(result.timezone).toBeNull();
    expect(result.requiresTimeZone).toBe(false);
  });

  it("uses event TZID with daylight-saving offsets", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;TZID=America/Chicago:20260115T090000
SUMMARY:Winter Event
UID:winter-event
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=America/Chicago:20260715T090000
SUMMARY:Summer Event
UID:summer-event
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics);

    expect(result.timezone).toBe("America/Chicago");
    expect(result.requiresTimeZone).toBe(false);
    expect(result.events[0].startTime.toISOString()).toBe(
      "2026-01-15T15:00:00.000Z",
    );
    expect(result.events[1].startTime.toISOString()).toBe(
      "2026-07-15T14:00:00.000Z",
    );
  });

  it("uses X-WR-TIMEZONE for floating timestamps", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
X-WR-TIMEZONE:America/Denver
BEGIN:VEVENT
DTSTART:20260715T090000
SUMMARY:Mountain Time Event
UID:mountain-event
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics);

    expect(result.timezone).toBe("America/Denver");
    expect(result.events[0].startTime.toISOString()).toBe(
      "2026-07-15T15:00:00.000Z",
    );
  });

  it("keeps UTC timestamps absolute when the convention zone changes", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260715T140000Z
SUMMARY:Absolute Event
UID:absolute-event
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "America/Chicago" });

    expect(result.timezone).toBe("America/Chicago");
    expect(result.events[0].startTime.toISOString()).toBe(
      "2026-07-15T14:00:00.000Z",
    );
  });

  it("requires a convention zone when the calendar has none", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260715T140000Z
SUMMARY:Absolute Event
UID:absolute-event
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics);

    expect(result.events).toHaveLength(1);
    expect(result.timezone).toBeNull();
    expect(result.requiresTimeZone).toBe(true);
  });

  it("parses all events from small-test.ics", () => {
    const result = parseIcs(loadSmallIcs());
    expect(result.events).toHaveLength(10);
  });

  it("parses basic event fields (title, uid)", () => {
    const result = parseIcs(loadSmallIcs());
    const opening = result.events.find(
      (e) => e.sourceUid === "test-opening-001",
    );
    expect(opening).toBeDefined();
    expect(opening!.title).toBe("Opening Ceremonies");
    expect(opening!.sourceUid).toBe("test-opening-001");
  });

  it("parses UTC datetime correctly", () => {
    const result = parseIcs(loadSmallIcs());
    const opening = result.events.find(
      (e) => e.sourceUid === "test-opening-001",
    );
    expect(opening).toBeDefined();
    // 20260612T160000Z = June 12, 2026 16:00 UTC
    expect(opening!.startTime.getUTCFullYear()).toBe(2026);
    expect(opening!.startTime.getUTCMonth()).toBe(5); // 0-indexed
    expect(opening!.startTime.getUTCDate()).toBe(12);
    expect(opening!.startTime.getUTCHours()).toBe(16);
  });

  it("parses event source URL", () => {
    const result = parseIcs(loadSmallIcs());
    const opening = result.events.find(
      (e) => e.sourceUid === "test-opening-001",
    );
    expect(opening!.sourceUrl).toBe(
      "https://testcon2026.sched.com/event/test-opening-001",
    );
  });

  it("unescapes \\n in description", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
DTEND:20260612T170000Z
SUMMARY:Test Event
DESCRIPTION:Line 1\\nLine 2\\nLine 3
UID:test-escape-newline
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    expect(result.events[0].description).toContain("\n");
    expect(result.events[0].description).toBe("Line 1\nLine 2\nLine 3");
  });

  it("unescapes \\, in description", () => {
    const result = parseIcs(loadSmallIcs());
    // "Calling all wolves\\, dogs\\, foxes" should become "Calling all wolves, dogs, foxes"
    const canine = result.events.find((e) => e.sourceUid === "test-canine-004");
    expect(canine!.description).toContain("wolves, dogs");
  });

  it("decodes HTML entities in description", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
DTEND:20260612T170000Z
SUMMARY:Test &amp; Event
DESCRIPTION:Foxes &amp; wolves &lt;3
UID:test-html-entities
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    expect(result.events[0].title).toBe("Test & Event");
    expect(result.events[0].description).toBe("Foxes & wolves <3");
  });

  it("handles line folding (multi-line values)", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
DTEND:20260612T170000Z
SUMMARY:Folded
 Line Title
DESCRIPTION:This is a very long description that gets
 folded onto multiple lines
UID:test-folding
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    // RFC 5545: unfolding removes the CRLF+WSP, so the space is the fold indicator not content
    expect(result.events[0].title).toBe("FoldedLine Title");
    expect(result.events[0].description).toContain(
      "folded onto multiple lines",
    );
  });

  it("splits location into room and location", () => {
    const result = parseIcs(loadSmallIcs());
    const opening = result.events.find(
      (e) => e.sourceUid === "test-opening-001",
    );
    // LOCATION:Main Stage\, Convention Center → room="Main Stage", location="Convention Center"
    expect(opening!.room).toBe("Main Stage");
    expect(opening!.location).toBe("Convention Center");
  });

  it("deduplicates categories and assigns colors", () => {
    const result = parseIcs(loadSmallIcs());
    // CONVENTION SERVICES appears for opening and closing (2 events)
    const convServices = result.categories.find(
      (c) => c.name === "CONVENTION SERVICES",
    );
    expect(convServices).toBeDefined();
    expect(convServices!.count).toBe(2);
    expect(convServices!.color).toMatch(/^#[0-9A-Fa-f]{6}$/);

    // Each category should be unique
    const names = result.categories.map((c) => c.name);
    expect(names).toHaveLength(new Set(names).size);
  });

  it("detects isAgeRestricted from title/description", () => {
    const result = parseIcs(loadSmallIcs());
    // test-trivia-009: "After Dark Trivia" with "18+ ONLY" in description
    const trivia = result.events.find((e) => e.sourceUid === "test-trivia-009");
    expect(trivia!.isAgeRestricted).toBe(true);
  });

  it("detects contentWarning for strobe effects", () => {
    const result = parseIcs(loadSmallIcs());
    // test-dance-005: "Friday Night Dance" with "strobe effects" in description
    const dance = result.events.find((e) => e.sourceUid === "test-dance-005");
    expect(dance!.contentWarning).toBe(true);
  });

  it("handles missing optional fields gracefully", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Minimal Event
UID:test-minimal
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    expect(result.events).toHaveLength(1);
    const ev = result.events[0];
    expect(ev.description).toBeNull();
    expect(ev.endTime).toBeNull();
    expect(ev.location).toBeNull();
    expect(ev.room).toBeNull();
    expect(ev.category).toBeNull();
    expect(ev.sourceUrl).toBeNull();
    expect(ev.isAgeRestricted).toBe(false);
    expect(ev.contentWarning).toBe(false);
  });

  it("deduplicates events with the same UID", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Duplicate Event
UID:test-dup-001
END:VEVENT
BEGIN:VEVENT
DTSTART:20260612T170000Z
SUMMARY:Duplicate Event Copy
UID:test-dup-001
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Duplicate Event");
  });

  it("keeps simultaneous events in different rooms", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
DTEND:20260612T170000Z
SUMMARY:Costume Workshop
LOCATION:Room A
UID:test-concurrent-a
END:VEVENT
BEGIN:VEVENT
DTSTART:20260612T160000Z
DTEND:20260612T170000Z
SUMMARY:Art Panel
LOCATION:Room B, Convention Center
UID:test-concurrent-b
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics);

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.room ?? event.location)).toEqual([
      "Room A",
      "Room B",
    ]);
    expect(result.events[0].startTime).toEqual(result.events[1].startTime);
  });

  it.each([
    ["RRULE", "RRULE:FREQ=DAILY;COUNT=3"],
    ["RDATE", "RDATE:20260613T160000Z,20260614T160000Z"],
    ["EXDATE", "EXDATE:20260613T160000Z"],
  ])(
    "rejects unsupported active %s recurrence definitions",
    (propertyName, recurrenceLine) => {
      const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Repeating Event
UID:repeating-event
${recurrenceLine}
END:VEVENT
END:VCALENDAR`;

      expect(() => parseIcs(ics, { timeZone: "UTC" })).toThrow(
        UnsupportedRecurrenceError,
      );
      expect(() => parseIcs(ics, { timeZone: "UTC" })).toThrow(propertyName);
      expect(() => parseIcs(ics, { timeZone: "UTC" })).toThrow(
        "Export an expanded .ics file",
      );
    },
  );

  it("allows recurrence definitions on cancellation tombstones", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:cancelled-series
STATUS:CANCELLED
RRULE:FREQ=DAILY;COUNT=3
RDATE:20260613T160000Z
EXDATE:20260614T160000Z
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "UTC" });

    expect(result.events).toEqual([]);
    expect(result.cancelledSourceUids).toEqual(["cancelled-series"]);
    expect(result.cancelledEvents).toEqual([
      {
        sourceUid: "cancelled-series",
        legacySourceUid: null,
        startTime: null,
        recurrenceTime: null,
        title: null,
        sourceUrl: null,
      },
    ]);
  });

  it("returns cancellation tombstones even when they omit event details", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:cancelled-series
RECURRENCE-ID;TZID=America/Chicago:20260612T160000
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics);

    expect(result.events).toEqual([]);
    expect(result.requiresTimeZone).toBe(false);
    expect(result.cancelledSourceUids).toEqual([
      "cancelled-series|20260612T160000",
    ]);
    expect(result.cancelledEvents).toEqual([
      {
        sourceUid: "cancelled-series|20260612T160000",
        legacySourceUid: "cancelled-series",
        startTime: null,
        recurrenceTime: new Date("2026-06-12T21:00:00.000Z"),
        title: null,
        sourceUrl: null,
      },
    ]);
  });

  it("lets a cancellation tombstone override a duplicate active occurrence", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Old occurrence
UID:recurring-event
RECURRENCE-ID:20260612T160000Z
END:VEVENT
BEGIN:VEVENT
UID:recurring-event
RECURRENCE-ID:20260612T160000Z
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "America/Chicago" });

    expect(result.events).toEqual([]);
    expect(result.cancelledSourceUids).toEqual([
      "recurring-event|20260612T160000Z",
    ]);
  });

  it("exposes the legacy bare UID for recurrence migration", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Moved occurrence
UID:recurring-event
RECURRENCE-ID:20260612T160000Z
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "America/Chicago" });

    expect(result.events[0].sourceUid).toBe("recurring-event|20260612T160000Z");
    expect(result.events[0].legacySourceUid).toBe("recurring-event");
    expect(result.events[0].recurrenceTime).toEqual(
      new Date("2026-06-12T16:00:00.000Z"),
    );
  });

  it("parses all-day event without time component", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612
DTEND:20260613
SUMMARY:All Day Event
UID:test-allday
END:VEVENT
END:VCALENDAR`;
    const result = parseIcs(ics, { timeZone: "UTC" });
    expect(result.events).toHaveLength(1);
    const ev = result.events[0];
    expect(ev.startTime.toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });
  it("keeps an astral-plane numeric entity intact", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Fursuit Parade &#128512;
UID:emoji-entity
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "UTC" });

    expect(result.events[0].title).toBe("Fursuit Parade \u{1F600}");
  });

  it("leaves an out-of-range or lone-surrogate entity as written", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Bad &#1114112; and &#55296; entities
UID:bad-entity
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "UTC" });

    expect(result.events[0].title).toBe("Bad &#1114112; and &#55296; entities");
  });

  it("keeps every tag when CATEGORIES is repeated across lines", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Late Night Panel
UID:repeated-categories
CATEGORIES:18+
CATEGORIES:Panels
CATEGORIES:Music
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "UTC" });
    const event = result.events[0];

    expect(event.categories).toEqual(["Panels", "Music"]);
    expect(event.category).toBe("Panels");
    // The audience tag arrived on the first line, which used to be discarded.
    expect(event.isAgeRestricted).toBe(true);
    expect(result.categories.map((category) => category.name).sort()).toEqual([
      "Music",
      "Panels",
    ]);
  });

  it("resolves an escaped backslash before an n as a literal n", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Regex Workshop
DESCRIPTION:Match C:\\\\next\\, then \\; stop\\nSecond line
UID:escaped-backslash
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "UTC" });

    expect(result.events[0].description).toBe(
      "Match C:\\next, then ; stop\nSecond line",
    );
  });

  it("does not let a __proto__ property line reach Object.prototype", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260612T160000Z
SUMMARY:Injected
UID:proto-line
__proto__:polluted
END:VEVENT
END:VCALENDAR`;

    const result = parseIcs(ics, { timeZone: "UTC" });

    expect(result.events).toHaveLength(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn({}, "__proto__")).toBe(false);
  });
});
