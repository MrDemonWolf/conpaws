import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type ParseResult, parseIcs } from "../ical-parser";

/**
 * Full-size characterization fixtures for the two export shapes ConPaws
 * actually receives. Both are dummied — invented convention, rooms, panels and
 * descriptions — but every structural property of the feed they were traced
 * from survives: event count, timestamps, property order, escaping, entity
 * use, line folding, UID and URL shape, category cardinality, same-minute
 * collisions and multi-day spans.
 *
 * `sched-example-con.ics` is the Sched shape: unfolded long lines, one
 * UPPERCASE topic per event, no audience tag, `Room, Venue` locations.
 *
 * `event-ticket-con.ics` is the shape a convention's own ticketing export
 * produces: RFC 5545 folding at 75 octets, several Title Case topics plus an
 * `Age ...` audience tag, `Area – Room` locations separated by an en-dash, and
 * a description that repeats the event's own permalink at the end.
 */
function loadFixture(name: string): ParseResult {
  return parseIcs(
    fs.readFileSync(
      path.resolve(__dirname, `../../../../../test-data/${name}`),
      "utf-8",
    ),
  );
}

const sched = loadFixture("sched-example-con.ics");
const ticket = loadFixture("event-ticket-con.ics");

describe("Sched Example Con export", () => {
  it("is tagged as a Sched feed", () => {
    expect(sched.source).toBe("sched");
  });

  it("reads the calendar zone off X-WR-TIMEZONE and needs no prompt", () => {
    expect(sched.timezone).toBe("UTC");
    expect(sched.requiresTimeZone).toBe(false);
  });

  it("keeps every VEVENT in the file", () => {
    expect(sched.events).toHaveLength(210);
    expect(sched.cancelledEvents).toEqual([]);
  });

  it("gives every event a usable identity, title and instant", () => {
    for (const event of sched.events) {
      expect(event.title.trim()).not.toBe("");
      expect(event.sourceUid).toMatch(/^[0-9a-f]{32}$/);
      expect(Number.isFinite(event.startTime.getTime())).toBe(true);
      expect(event.sourceUrl).toMatch(
        /^http:\/\/schedexamplecon\.sched\.com\/event\/[0-9a-f]{32}$/,
      );
    }
  });

  it("splits every location on the comma into room and venue", () => {
    for (const event of sched.events) {
      expect(event.room).not.toBeNull();
      expect(event.location).toBe("Riverside Grand Hotel");
    }
  });

  it("carries exactly one topic per event and no audience tag", () => {
    for (const event of sched.events) {
      expect(event.categories).toHaveLength(1);
    }
    // Sched exports have no `Age ...` tags, so any rating can only have come
    // from the description prose, not from the feed.
    expect(sched.categories.map((category) => category.name).sort()).toEqual([
      "ARTS & CRAFTS",
      "CONVENTION SERVICES",
      "COSTUMING",
      "ENTERTAINMENT",
      "GAMING",
      "MEET & GREET",
      "MUSIC & DANCE",
      "PARTNER EVENTS",
      "PERFORMANCE",
      "PRESENTATION",
      "SOCIAL",
      "WRITING",
    ]);
  });

  it("decodes the &nbsp; entities the export embeds in descriptions", () => {
    const withEntity = sched.events.filter((event) =>
      event.description?.includes("&nbsp"),
    );
    expect(withEntity).toEqual([]);
  });

  it("holds several events that start in the same minute", () => {
    const starts = sched.events.map((event) => event.startTime.getTime());
    expect(new Set(starts).size).toBeLessThan(starts.length);
  });
});

describe("Event Ticket Con export", () => {
  it("is tagged as a generic feed", () => {
    expect(ticket.source).toBe("generic");
  });

  it("reads the convention's real IANA zone off X-WR-TIMEZONE", () => {
    expect(ticket.timezone).toBe("America/Indiana/Indianapolis");
    expect(ticket.requiresTimeZone).toBe(false);
  });

  it("keeps every VEVENT in the file", () => {
    expect(ticket.events).toHaveLength(202);
    expect(ticket.cancelledEvents).toEqual([]);
  });

  it("unfolds descriptions back into whole sentences", () => {
    // Every description in this feed is folded across several physical lines,
    // and the fold points fall mid-word. A failure to unfold leaves the
    // continuation marker behind as a stray space or a broken word.
    for (const event of ticket.events) {
      expect(event.description).not.toBeNull();
      expect(event.description).not.toMatch(/ {2,}/);
    }
    // One sentence long enough to straddle a 75-octet fold, intact.
    const straddling = ticket.events.filter((event) =>
      event.description?.includes(
        "We will finish with a short show and tell for anyone who wants one",
      ),
    );
    expect(straddling.length).toBeGreaterThan(0);
  });

  it("splits en-dash locations into an area and a room", () => {
    const dashed = ticket.events.filter((event) => event.room !== null);
    // The majority of this feed uses `Area – Room`; the rest name a single
    // space with no separator at all.
    expect(dashed.length).toBeGreaterThan(ticket.events.length * 0.8);
    for (const event of dashed) {
      expect(event.room).not.toContain("–");
      expect(event.location).not.toContain("–");
    }
    // Nothing is left holding an unsplit `Area – Room` string.
    for (const event of ticket.events) {
      expect(event.location ?? "").not.toMatch(/\s–\s/);
    }
  });

  it("keeps bare single-name locations as the location, with no room", () => {
    const bare = ticket.events.filter((event) => event.room === null);
    expect(bare.length).toBeGreaterThan(0);
    for (const event of bare) {
      expect(event.location?.trim()).toBeTruthy();
    }
  });

  it("takes the audience rating from the feed's Age tag", () => {
    const rated = ticket.events.filter((event) => event.ageRating !== null);
    expect(rated.length).toBe(ticket.events.length);
    // The audience tag is consumed, not left sitting in the topic list.
    for (const event of ticket.events) {
      for (const category of event.categories) {
        expect(category).not.toMatch(/^Age /);
      }
    }
    // A handful of events are tagged with an audience and nothing else, so an
    // empty topic list is legitimate here — but most events do carry a topic.
    const topical = ticket.events.filter(
      (event) => event.categories.length > 0,
    );
    expect(topical.length).toBeGreaterThan(ticket.events.length * 0.8);
  });

  it("drops the permalink this export repeats at the end of every description", () => {
    for (const event of ticket.events) {
      expect(event.sourceUrl).not.toBeNull();
      expect(event.description).not.toBeNull();
      expect(event.description?.endsWith(event.sourceUrl ?? "")).toBe(false);
      expect(event.description).not.toContain("eventticketcon.example.org");
    }
  });

  it("holds several events that start in the same minute", () => {
    const starts = ticket.events.map((event) => event.startTime.getTime());
    expect(new Set(starts).size).toBeLessThan(starts.length);
  });
});

/**
 * The Events Calendar (ECP) export — a third shape, and the only one that
 * publishes no `X-WR-TIMEZONE` at all. The zone has to come off the first
 * event's `DTSTART;TZID` parameter, and every timestamp is local wall-clock
 * rather than UTC, so the conversion is what this fixture is really testing.
 * It also carries a VTIMEZONE block whose STANDARD/DAYLIGHT sections contain
 * their own bare `DTSTART:` lines, plus events that omit LOCATION or
 * CATEGORIES entirely.
 */
const tribe = loadFixture("tribe-events-con.ics");

describe("Tribe Events Con export", () => {
  it("is tagged as a generic feed", () => {
    expect(tribe.source).toBe("generic");
  });

  it("resolves the zone from DTSTART;TZID when X-WR-TIMEZONE is absent", () => {
    expect(tribe.timezone).toBe("America/Indiana/Indianapolis");
    expect(tribe.requiresTimeZone).toBe(false);
  });

  it("does not mistake the VTIMEZONE block's DTSTART lines for events", () => {
    // BEGIN:DAYLIGHT / BEGIN:STANDARD each carry a bare `DTSTART:`; only the
    // events' `DTSTART;TZID=` form may be read.
    expect(tribe.events).toHaveLength(30);
    expect(tribe.cancelledEvents).toEqual([]);
  });

  it("converts local wall-clock times through the convention zone", () => {
    const [first] = tribe.events;
    // 2026-09-03 17:00 in Indiana is EDT (UTC-4), so 21:00Z.
    expect(first.startTime.toISOString()).toBe("2026-09-03T21:00:00.000Z");
    for (const event of tribe.events) {
      expect(Number.isFinite(event.startTime.getTime())).toBe(true);
    }
  });

  it("keeps the UID and permalink shape this export uses", () => {
    for (const event of tribe.events) {
      expect(event.sourceUid).toMatch(
        /^\d+-\d+-\d+@tribeeventscon\.example\.org$/,
      );
      expect(event.sourceUrl).toMatch(
        /^https:\/\/tribeeventscon\.example\.org\/panel\//,
      );
    }
  });

  it("tolerates events that omit LOCATION or CATEGORIES", () => {
    const withoutLocation = tribe.events.filter(
      (event) => event.location === null,
    );
    expect(withoutLocation.length).toBeGreaterThan(0);
    for (const event of withoutLocation) {
      expect(event.room).toBeNull();
    }

    const withoutCategories = tribe.events.filter(
      (event) => event.categories.length === 0,
    );
    expect(withoutCategories.length).toBeGreaterThan(0);
    for (const event of withoutCategories) {
      expect(event.category).toBeNull();
    }
  });

  it("keeps an empty DESCRIPTION as null rather than an empty string", () => {
    const empty = tribe.events.filter((event) => event.description === null);
    expect(empty.length).toBeGreaterThan(0);
  });

  it("reads the '13+ Teen' and 'Mature 17+' audience tags this export uses", () => {
    const rated = tribe.events.filter((event) => event.ageRating !== null);
    expect(rated.length).toBeGreaterThan(0);
    // The audience tag is consumed, not left sitting in the topic list.
    for (const event of tribe.events) {
      for (const category of event.categories) {
        expect(category).not.toMatch(/\d\+|All Ages|Mature|Teen/i);
      }
    }
    expect(new Set(rated.map((event) => event.ageRating)).size).toBeGreaterThan(
      1,
    );
  });
});
