import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIcs } from "../ical-parser";

/**
 * A hand-sized Sched-shaped export, kept as a characterization fixture.
 *
 * The hand-written VCALENDAR strings elsewhere in this suite each isolate one
 * anticipated shape. This file is the arrangement an actual convention shipped
 * — traced from a real export, with every convention, venue, room, panel and
 * person name replaced: unfolded long lines, `&nbsp;` entities, escaped commas
 * inside LOCATION, ampersands inside category names, an event that spans the
 * whole weekend, several events starting in the same minute, and an empty
 * DESCRIPTION. Assertions here describe what the parser does with that file
 * today, so a change in behaviour has to be a deliberate one.
 *
 * The two STATUS:CANCELLED blocks are the one part of this file no real feed
 * we hold supplies — Sched drops a cancelled row rather than publishing it —
 * so they are written by hand to cover both tombstone shapes the reconciler
 * distinguishes.
 */
const SMALL_FEED_PATH = path.resolve(
  __dirname,
  "../../../../../test-data/sched-small-con.ics",
);

const result = parseIcs(fs.readFileSync(SMALL_FEED_PATH, "utf-8"));

describe("Sched Small Con export", () => {
  it("is tagged as a Sched feed", () => {
    expect(result.source).toBe("sched");
  });

  it("reads the calendar zone off X-WR-TIMEZONE and needs no prompt", () => {
    expect(result.timezone).toBe("UTC");
    expect(result.requiresTimeZone).toBe(false);
  });

  it("keeps every active VEVENT and no cancelled one", () => {
    expect(result.events).toHaveLength(16);
    expect(result.cancelledEvents).toHaveLength(2);
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

    expect(opening?.room).toBe("Secondary Events - Cedar Ballrooms 4&5");
    expect(opening?.location).toBe("Riverside Grand Hotel");
    // Every event in this feed shares the one venue.
    for (const event of result.events) {
      expect(event.location).toBe("Riverside Grand Hotel");
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
    expect(dance?.description).toContain("10pm - DJ Driftwood\n11pm - DJ Kite");

    const opening = result.events.find(
      (event) => event.title === "Opening Ceremonies",
    );
    // `&nbsp;` decodes to a real space, leaving two in a row.
    expect(opening?.description).toContain("Harborfall.  You have");
  });

  it("keeps an empty DESCRIPTION as null rather than an empty string", () => {
    const closing = result.events.find(
      (event) => event.title === "Closing Ceremonies",
    );
    expect(closing?.description).toBeNull();
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
    // check, so distinctness is a property of this particular name set rather
    // than something the parser guarantees; assign colours by position within
    // one import if the filter chips are ever meant to be told apart by colour
    // alone.
    const names = result.categories.map((category) => category.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("ARTS & CRAFTS");
    expect(names).toContain("MEET & GREET");
  });

  it("flags the one adult event from its description alone", () => {
    // The feed carries no rating property; this comes out of the wording.
    const restricted = result.events.filter((event) => event.isAgeRestricted);
    expect(restricted.map((event) => event.title)).toEqual([
      "Party Games After Dark",
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
      (event) => event.title === "Open Tabletop Library",
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
      "Beginner RPG Session",
    ]);
    expect(new Set(atOpeningHour.map((event) => event.room)).size).toBe(2);
  });
});

describe("cancellations", () => {
  it("drops an event the same file cancels further down", () => {
    // "Sketchbook Swap" is published as an active VEVENT and then cancelled.
    // The cancellation wins regardless of which block came first.
    expect(
      result.events.some((event) => event.title === "Sketchbook Swap"),
    ).toBe(false);
    expect(result.cancelledSourceUids).toContain(
      "1f0b2c6d4e8a49b7a1c3d5e7f9a0b1c2",
    );
  });

  it("keeps a bare tombstone for a UID with no active block", () => {
    const tombstone = result.cancelledEvents.find(
      (event) => event.sourceUid === "9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a",
    );

    expect(tombstone).toBeDefined();
    expect(tombstone?.title).toBe("Puppet Building Workshop");
    // No RECURRENCE-ID, so this tombstone claims the whole series and is what
    // removes a row an earlier import created.
    expect(tombstone?.legacySourceUid).toBeNull();
    expect(tombstone?.startTime?.toISOString()).toBe(
      "2025-08-16T19:00:00.000Z",
    );
  });

  it("reports every cancelled uid alongside the cancelled events", () => {
    expect([...result.cancelledSourceUids].sort()).toEqual(
      result.cancelledEvents.map((event) => event.sourceUid).sort(),
    );
  });
});

describe("category colours", () => {
  it("gives every category in this convention a distinct colour", () => {
    const colors = result.categories.map((category) => category.color);

    expect(colors.length).toBeGreaterThan(1);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("depends on the set of names, not the order they appeared", () => {
    const again = parseIcs(fs.readFileSync(SMALL_FEED_PATH, "utf-8"));
    const asMap = (categories: typeof result.categories) =>
      new Map(categories.map((category) => [category.name, category.color]));

    expect(asMap(again.categories)).toEqual(asMap(result.categories));
  });
});
