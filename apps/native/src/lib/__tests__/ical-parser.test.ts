import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { parseIcs } from "../ical-parser";

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
    expect(result.categories).toHaveLength(0);
    expect(result.timezone).toBeNull();
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
    const result = parseIcs(ics);
    expect(result.events).toHaveLength(1);
    const ev = result.events[0];
    expect(ev.startTime.getFullYear()).toBe(2026);
    expect(ev.startTime.getMonth()).toBe(5);
    expect(ev.startTime.getDate()).toBe(12);
  });
});
