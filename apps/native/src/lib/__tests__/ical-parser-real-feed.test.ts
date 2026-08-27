import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIcs } from "../ical-parser";

/**
 * A real Sched export, kept as a characterization fixture.
 *
 * The hand-written VCALENDAR strings elsewhere in this suite each isolate one
 * anticipated shape. This file is the arrangement an actual convention shipped:
 * unfolded long lines, `&nbsp;` entities, escaped commas inside LOCATION,
 * ampersands inside category names, an event that spans the whole weekend, and
 * several events starting in the same minute. Assertions here describe what the
 * parser does with that file today, so a change in behaviour has to be a
 * deliberate one.
 */
const REAL_ICS_PATH = path.resolve(
  __dirname,
  "../../../../../test-data/indyfurcon2025.ics",
);

const result = parseIcs(fs.readFileSync(REAL_ICS_PATH, "utf-8"));

describe("IndyFurCon 2025 export", () => {
  it("reads the calendar zone off X-WR-TIMEZONE and needs no prompt", () => {
    expect(result.timezone).toBe("UTC");
    expect(result.requiresTimeZone).toBe(false);
  });

  it("keeps every VEVENT in the file", () => {
    expect(result.events).toHaveLength(16);
    expect(result.cancelledEvents).toEqual([]);
    expect(result.cancelledSourceUids).toEqual([]);
  });

  it("gives every event a usable identity, title and instant", () => {
    for (const event of result.events) {
      expect(event.title.trim()).not.toBe("");
      expect(event.sourceUid).toMatch(/^[0-9a-f]{32}$/);
      expect(Number.isFinite(event.startTime.getTime())).toBe(true);
      expect(Number.isFinite(event.endTime?.getTime() ?? 0)).toBe(true);
      expect(event.sourceUrl).toContain(event.sourceUid);
      // Nothing in this feed recurs, so nothing may claim a series identity.
      expect(event.legacySourceUid).toBeNull();
      expect(event.recurrenceTime).toBeNull();
    }

    const uids = result.events.map((event) => event.sourceUid);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it("returns events in start order", () => {
    const starts = result.events.map((event) => event.startTime.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("splits the venue off the room at the escaped comma", () => {
    const opening = result.events.find(
      (event) => event.title === "Opening Ceremonies",
    );

    expect(opening?.room).toBe("Secondary Events - Golden Ballrooms 4&5");
    expect(opening?.location).toBe("Wyndham Indianapolis Airport");
    // Every event in this feed shares the one venue.
    for (const event of result.events) {
      expect(event.location).toBe("Wyndham Indianapolis Airport");
      expect(event.room).not.toBeNull();
    }
  });

  it("leaves no source escaping in a description the app will render", () => {
    for (const event of result.events) {
      if (!event.description) continue;
      expect(event.description).not.toMatch(/&[a-z]+;|&#\d+;/i);
      expect(event.description).not.toMatch(/\\[,;n]/);
    }

    const dance = result.events.find(
      (event) => event.title === "Thursday Night Dance",
    );
    // The lineup arrives as literal "\n" pairs in the file.
    expect(dance?.description).toContain(
      "10pm - Rocco the Racc\n11pm - DJ Kai",
    );

    const opening = result.events.find(
      (event) => event.title === "Opening Ceremonies",
    );
    expect(opening?.description).toContain("Indyfurnapolis.  You have");
  });

  it("tallies every category, ampersands and all", () => {
    const total = result.categories.reduce(
      (sum, category) => sum + category.count,
      0,
    );
    expect(total).toBe(result.events.length);

    for (const category of result.categories) {
      expect(category.name.trim()).not.toBe("");
      expect(category.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }

    // Colour is a hash into a 15-entry palette with no per-import collision
    // check, and this feed already collides: "SOCIAL" and "MUSIC & DANCE" come
    // back the same pink. Distinctness is deliberately not asserted here,
    // because it does not hold; assign colours by position within one import
    // if the filter chips are ever meant to be told apart by colour alone.

    const names = result.categories.map((category) => category.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("ARTS & CRAFTS");
    expect(names).toContain("MEET & GREET");
  });

  it("flags the one adult event from its description alone", () => {
    // The feed carries no rating property; this comes out of the wording.
    const restricted = result.events.filter((event) => event.isAgeRestricted);
    expect(restricted.map((event) => event.title)).toEqual([
      "Jackbox After Dark",
    ]);
    expect(restricted[0].ageRating).toBe("adult");
  });

  it("flags the strobe warning as a content warning", () => {
    const warned = result.events.filter((event) => event.contentWarning);
    expect(warned.map((event) => event.title)).toEqual([
      "Thursday Night Dance",
    ]);
  });

  it("keeps a weekend-long event whole rather than splitting it per day", () => {
    const tabletop = result.events.find(
      (event) => event.title === "Tabletop Gaming",
    );

    expect(tabletop?.startTime.toISOString()).toBe("2025-08-14T22:00:00.000Z");
    expect(tabletop?.endTime?.toISOString()).toBe("2025-08-17T21:00:00.000Z");
  });

  it("keeps simultaneous events in different rooms", () => {
    const atOpeningHour = result.events.filter(
      (event) => event.startTime.toISOString() === "2025-08-14T23:00:00.000Z",
    );

    expect(atOpeningHour.map((event) => event.title)).toEqual([
      "Opening Ceremonies",
      "Ironclaw Intro",
    ]);
    expect(new Set(atOpeningHour.map((event) => event.room)).size).toBe(2);
  });
});
