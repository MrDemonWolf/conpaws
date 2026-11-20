import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildIcsFromEcpEvents, normalizeEcpUids } from "@/lib/ecp-feed";
import { parseIcs } from "@/lib/ical-parser";
import { toSourceEvents, toSourceSnapshot } from "@/lib/schedule-source";
import { initializeDatabase } from "../bootstrap";
import type { ConventionEvent } from "../schema";
import {
  getAllInSchedule,
  planSourceReconciliation,
  type SourceEventInput,
  type SourceOccurrenceIdentity,
  type SourceSnapshot,
  setScheduleMembership,
  upsertBySourceUid,
} from "./events";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { transaction: vi.fn(), select: vi.fn() },
}));

vi.mock("../index", () => ({ db: mockDb }));

/**
 * A migrated in-memory store behind a read-only Drizzle proxy, for reads whose
 * filter is the thing under test: the real query runs against the real schema.
 */
function migratedStore() {
  const database = new DatabaseSync(":memory:");
  initializeDatabase({
    execSync: (source: string) => {
      database.exec(source);
    },
    getFirstSync: <T>(source: string): T | null =>
      (database.prepare(source).get() as T | undefined) ?? null,
  });
  const store = drizzle(async (query, params) => {
    const statement = database.prepare(query);
    statement.setReturnArrays(true);
    return { rows: statement.all(...(params as SQLInputValue[])) as never[] };
  });
  return { database, store };
}

function storedEvent(
  overrides: Partial<ConventionEvent> = {},
): ConventionEvent {
  return {
    id: "event-1",
    conventionId: "convention-1",
    title: "Legacy event",
    description: null,
    startTime: "2026-06-12T16:00:00.000Z",
    endTime: "2026-06-12T17:00:00.000Z",
    location: null,
    room: "Room A",
    category: "Panels",
    type: null,
    isInSchedule: true,
    reminderMinutes: 15,
    sourceUid: "recurring-event",
    sourceUrl: null,
    isAgeRestricted: false,
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function sourceEvent(
  overrides: Partial<SourceEventInput> = {},
): SourceEventInput {
  return {
    conventionId: "convention-1",
    title: "Updated event",
    description: null,
    startTime: "2026-06-12T18:00:00.000Z",
    endTime: "2026-06-12T19:00:00.000Z",
    location: null,
    room: "Room B",
    category: "Panels",
    type: null,
    isInSchedule: false,
    reminderMinutes: null,
    sourceUid: "recurring-event|20260612T160000Z",
    legacySourceUid: "recurring-event",
    sourceUrl: null,
    isAgeRestricted: false,
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
    ...overrides,
  };
}

function occurrence(
  overrides: Partial<SourceOccurrenceIdentity> = {},
): SourceOccurrenceIdentity {
  return {
    sourceUid: "recurring-event|20260612T160000Z",
    legacySourceUid: "recurring-event",
    startTime: "2026-06-12T18:00:00.000Z",
    recurrenceTime: "2026-06-12T16:00:00.000Z",
    title: "Updated event",
    sourceUrl: null,
    ...overrides,
  };
}

/** An Apple-style export: the event's VALARM carries a UID of its own. */
const APPLE_ALARM_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-uid-1
DTSTART:20260612T160000Z
DTEND:20260612T170000Z
SUMMARY:Opening Ceremonies
DESCRIPTION:Welcome
BEGIN:VALARM
UID:alarm-uid-1
X-WR-ALARMUID:alarm-uid-1
ACTION:DISPLAY
TRIGGER:-PT15M
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;

/**
 * That event as an earlier build stored it: the last UID and DESCRIPTION in
 * the block, the alarm's, replaced the event's own.
 */
function alarmKeyedRow(): ConventionEvent {
  return storedEvent({
    id: "saved",
    sourceUid: "alarm-uid-1",
    title: "Opening Ceremonies",
    description: "Reminder",
    startTime: "2026-06-12T16:00:00.000Z",
    endTime: "2026-06-12T17:00:00.000Z",
    room: null,
    category: null,
    isInSchedule: true,
    reminderMinutes: 15,
  });
}

/** An Events Calendar `?ical=1` export, which names each post by its times. */
const ECP_EXPORT_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Example Con - ECPv6.17.3.1//NONSGML v1.0//EN",
  "X-WR-TIMEZONE:America/Chicago",
  "BEGIN:VEVENT",
  "UID:8154-1788454800-1788458400@examplecon.org",
  "DTSTART:20260903T170000Z",
  "DTEND:20260903T180000Z",
  "SUMMARY:Opening Ceremonies",
  "LOCATION:Main Stage",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:6569-1788462000-1788465600@examplecon.org",
  "DTSTART:20260903T190000Z",
  "DTEND:20260903T200000Z",
  "SUMMARY:Fursuit Parade",
  "LOCATION:Main Stage",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

/** The same two posts as the REST expansion renders them. */
const ECP_REST_ICS = buildIcsFromEcpEvents([
  {
    id: 8154,
    title: "Opening Ceremonies",
    utc_start_date: "2026-09-03 17:00:00",
    utc_end_date: "2026-09-03 18:00:00",
    timezone: "America/Chicago",
    venue: { venue: "Main Stage" },
  },
  {
    id: 6569,
    title: "Fursuit Parade",
    utc_start_date: "2026-09-03 19:00:00",
    utc_end_date: "2026-09-03 20:00:00",
    timezone: "America/Chicago",
    venue: { venue: "Main Stage" },
  },
]);

/**
 * That export as builds before UID normalization stored it, under the
 * export's own UIDs. The opening is saved with a reminder; the parade is not.
 */
function ecpExportKeyedRows(): ConventionEvent[] {
  return parseIcs(ECP_EXPORT_ICS).events.map((event) =>
    storedEvent({
      id: event.sourceUid.split("-")[0],
      sourceUid: event.sourceUid,
      title: event.title,
      startTime: event.startTime.toISOString(),
      endTime: event.endTime?.toISOString() ?? null,
      location: event.location,
      room: event.room,
      category: event.category,
      isInSchedule: event.title === "Opening Ceremonies",
      reminderMinutes: event.title === "Opening Ceremonies" ? 15 : null,
    }),
  );
}

function snapshot(
  activeOccurrences: SourceOccurrenceIdentity[] = [],
  cancelledOccurrences: SourceOccurrenceIdentity[] = [],
  authoritative = true,
): SourceSnapshot {
  return {
    activeOccurrences,
    cancelledOccurrences,
    authoritative,
  };
}

describe("source snapshot reconciliation", () => {
  it("reuses a legacy row for a uniquely identifiable moved occurrence", () => {
    const imported = sourceEvent();
    const existing = storedEvent({
      startTime: "2026-06-12T16:00:00.000Z",
    });

    const plan = planSourceReconciliation(
      [existing],
      [imported],
      snapshot([occurrence()]),
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].existingId).toBe("event-1");
    expect(plan.updates[0].event.sourceUid).toBe(
      "recurring-event|20260612T160000Z",
    );
    expect(existing).toMatchObject({
      id: "event-1",
      isInSchedule: true,
      reminderMinutes: 15,
    });
  });

  it("uses the authoritative singleton fallback when time evidence changed", () => {
    const master = storedEvent({
      id: "master",
      startTime: "2026-06-12T15:00:00.000Z",
    });
    const movedException = sourceEvent({
      startTime: "2026-06-12T18:00:00.000Z",
    });

    const plan = planSourceReconciliation(
      [master],
      [movedException],
      snapshot([occurrence()]),
    );

    expect(plan.updates).toEqual([
      { existingId: "master", event: movedException },
    ]);
    expect(plan.inserts).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
  });

  it("removes missing and cancelled feed rows but keeps manual and unselected active rows", () => {
    const unselected = storedEvent({
      id: "unselected",
      sourceUid: "feed-active",
    });
    const missing = storedEvent({ id: "missing", sourceUid: "feed-missing" });
    const cancelled = storedEvent({
      id: "cancelled",
      sourceUid: "series|20260612T160000Z",
    });
    const manual = storedEvent({ id: "manual", sourceUid: null });

    const plan = planSourceReconciliation(
      [unselected, missing, cancelled, manual],
      [],
      snapshot(
        [
          occurrence({
            sourceUid: "feed-active",
            legacySourceUid: null,
            startTime: unselected.startTime,
            recurrenceTime: null,
          }),
        ],
        [
          occurrence({
            sourceUid: "series",
            legacySourceUid: null,
          }),
        ],
      ),
    );

    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    // Every row here is saved (the fixture stars by default), so none of them
    // is deleted. The two marks differ because the feed said different things:
    // the series was announced cancelled, the other row merely stopped
    // appearing.
    expect(plan.removals).toEqual([]);
    expect(
      plan.tombstones
        .map((tombstone) => `${tombstone.existingId}:${tombstone.status}`)
        .sort(),
    ).toEqual(["cancelled:cancelled", "missing:removed"]);
  });

  it("still deletes an unsaved event the feed dropped", () => {
    const unsaved = storedEvent({
      id: "unsaved",
      sourceUid: "feed-missing",
      isInSchedule: false,
    });

    const plan = planSourceReconciliation([unsaved], [], snapshot([], []));

    // The mark exists to protect a decision the user made. Nobody decided
    // anything about this row, and keeping every panel a convention ever
    // published would make the schedule unreadable within a day.
    expect(plan.tombstones).toEqual([]);
    expect(plan.removals.map((event) => event.id)).toEqual(["unsaved"]);
  });

  it("leaves a saved event in place when the feed drops it", () => {
    const saved = storedEvent({
      id: "saved",
      sourceUid: "feed-missing",
      isInSchedule: true,
      reminderMinutes: 15,
    });

    const plan = planSourceReconciliation([saved], [], snapshot([], []));

    expect(plan.removals).toEqual([]);
    expect(plan.tombstones).toEqual([
      { existingId: "saved", status: "removed" },
    ]);
  });

  it("keeps unrelated feed rows for a partial local file while applying explicit cancellations", () => {
    const unrelated = storedEvent({
      id: "unrelated",
      sourceUid: "another-feed-event",
    });
    // Unsaved on purpose: this test is about which row the planner picks, not
    // about the protection saved rows get. `leaves a saved event in place`
    // covers that.
    const cancelled = storedEvent({
      id: "cancelled",
      sourceUid: "cancelled-event",
      isInSchedule: false,
    });

    const plan = planSourceReconciliation(
      [unrelated, cancelled],
      [],
      snapshot(
        [],
        [
          occurrence({
            sourceUid: "cancelled-event",
            legacySourceUid: null,
          }),
        ],
        false,
      ),
    );

    expect(plan.removals.map((event) => event.id)).toEqual(["cancelled"]);
  });

  it("maps two legacy rows to two composite identities without losing row state", () => {
    const firstLegacy = storedEvent({
      id: "legacy-first",
      startTime: "2026-06-12T16:00:00.000Z",
      isInSchedule: true,
      reminderMinutes: 15,
    });
    const secondLegacy = storedEvent({
      id: "legacy-second",
      startTime: "2026-06-12T17:00:00.000Z",
      isInSchedule: false,
      reminderMinutes: 30,
    });
    const firstIdentity = occurrence();
    const secondIdentity = occurrence({
      sourceUid: "recurring-event|20260612T170000Z",
      startTime: "2026-06-12T19:00:00.000Z",
      recurrenceTime: "2026-06-12T17:00:00.000Z",
    });
    const firstImport = sourceEvent();
    const secondImport = sourceEvent({
      sourceUid: secondIdentity.sourceUid,
      startTime: secondIdentity.startTime as string,
    });

    const plan = planSourceReconciliation(
      [firstLegacy, secondLegacy],
      [firstImport, secondImport],
      snapshot([firstIdentity, secondIdentity]),
    );

    expect(
      plan.updates.map(({ existingId, event }) => [
        existingId,
        event.sourceUid,
      ]),
    ).toEqual([
      ["legacy-first", firstIdentity.sourceUid],
      ["legacy-second", secondIdentity.sourceUid],
    ]);
    expect(plan.inserts).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
    expect(firstLegacy).toMatchObject({
      id: "legacy-first",
      isInSchedule: true,
      reminderMinutes: 15,
    });
    expect(secondLegacy).toMatchObject({
      id: "legacy-second",
      isInSchedule: false,
      reminderMinutes: 30,
    });
  });

  it("reserves an unselected occurrence and migrates only its identity", () => {
    const firstLegacy = storedEvent({
      id: "selected",
      startTime: "2026-06-12T16:00:00.000Z",
    });
    const secondLegacy = storedEvent({
      id: "unselected",
      startTime: "2026-06-12T17:00:00.000Z",
      isInSchedule: true,
      reminderMinutes: 30,
    });
    const selectedIdentity = occurrence();
    const unselectedIdentity = occurrence({
      sourceUid: "recurring-event|20260612T170000Z",
      startTime: "2026-06-12T19:00:00.000Z",
      recurrenceTime: "2026-06-12T17:00:00.000Z",
    });
    const selectedImport = sourceEvent();

    const plan = planSourceReconciliation(
      [firstLegacy, secondLegacy],
      [selectedImport],
      snapshot([selectedIdentity, unselectedIdentity]),
    );

    expect(plan.updates).toEqual([
      { existingId: "selected", event: selectedImport },
    ]);
    expect(plan.identityUpdates).toEqual([
      {
        existingId: "unselected",
        sourceUid: unselectedIdentity.sourceUid,
      },
    ]);
    expect(plan.inserts).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
  });

  it("removes an exact composite cancellation without removing its sibling", () => {
    const cancelled = storedEvent({
      id: "cancelled-composite",
      sourceUid: "recurring-event|20260612T160000Z",
      startTime: "2026-06-12T18:00:00.000Z",
      isInSchedule: false,
    });
    const sibling = storedEvent({
      id: "active-composite",
      sourceUid: "recurring-event|20260612T170000Z",
      startTime: "2026-06-12T19:00:00.000Z",
    });
    const activeSibling = occurrence({
      sourceUid: sibling.sourceUid as string,
      startTime: sibling.startTime,
      recurrenceTime: "2026-06-12T17:00:00.000Z",
    });

    const plan = planSourceReconciliation(
      [cancelled, sibling],
      [],
      snapshot([activeSibling], [occurrence()], false),
    );

    expect(plan.removals.map((event) => event.id)).toEqual([
      "cancelled-composite",
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
  });

  it("uniquely matches a composite cancellation to one legacy sibling", () => {
    const cancelled = storedEvent({
      id: "cancelled-legacy",
      startTime: "2026-06-12T16:00:00.000Z",
      isInSchedule: false,
    });
    const sibling = storedEvent({
      id: "active-legacy",
      startTime: "2026-06-12T17:00:00.000Z",
    });
    const activeSibling = occurrence({
      sourceUid: "recurring-event|20260612T170000Z",
      startTime: "2026-06-12T19:00:00.000Z",
      recurrenceTime: "2026-06-12T17:00:00.000Z",
    });

    const plan = planSourceReconciliation(
      [cancelled, sibling],
      [],
      snapshot([activeSibling], [occurrence()], false),
    );

    expect(plan.removals.map((event) => event.id)).toEqual([
      "cancelled-legacy",
    ]);
    expect(plan.identityUpdates).toEqual([
      {
        existingId: "active-legacy",
        sourceUid: activeSibling.sourceUid,
      },
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
  });

  it("does nothing to an ambiguous legacy series", () => {
    const exact = storedEvent({
      id: "exact",
      sourceUid: "recurring-event|20260612T160000Z",
      startTime: "2026-06-12T18:00:00.000Z",
    });
    const bareFirst = storedEvent({
      id: "bare-first",
      startTime: "2026-06-12T20:00:00.000Z",
    });
    const bareSecond = storedEvent({
      id: "bare-second",
      startTime: "2026-06-12T21:00:00.000Z",
    });
    const exactIdentity = occurrence();
    const unresolvedFirst = occurrence({
      sourceUid: "recurring-event|20260612T170000Z",
      startTime: "2026-06-12T17:00:00.000Z",
      recurrenceTime: "2026-06-12T17:00:00.000Z",
    });
    const unresolvedSecond = occurrence({
      sourceUid: "recurring-event|20260612T180000Z",
      startTime: "2026-06-12T19:00:00.000Z",
      recurrenceTime: "2026-06-12T18:00:00.000Z",
    });

    const plan = planSourceReconciliation(
      [exact, bareFirst, bareSecond],
      [
        sourceEvent(),
        sourceEvent({
          sourceUid: unresolvedFirst.sourceUid,
          startTime: unresolvedFirst.startTime as string,
        }),
        sourceEvent({
          sourceUid: unresolvedSecond.sourceUid,
          startTime: unresolvedSecond.startTime as string,
        }),
      ],
      snapshot([exactIdentity, unresolvedFirst, unresolvedSecond]),
    );

    expect(plan.updates).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.unresolvedSeries).toEqual(["recurring-event"]);
  });

  it("removes every absent source row from an authoritative empty snapshot", () => {
    const bare = storedEvent({ id: "bare", isInSchedule: false });
    const composite = storedEvent({
      id: "composite",
      sourceUid: "recurring-event|20260612T160000Z",
      isInSchedule: false,
    });
    const manual = storedEvent({ id: "manual", sourceUid: null });

    const plan = planSourceReconciliation(
      [bare, composite, manual],
      [],
      snapshot(),
    );

    expect(plan.removals.map((event) => event.id).sort()).toEqual([
      "bare",
      "composite",
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
  });

  it("updates a moved ordinary event from a partial local snapshot", () => {
    const existing = storedEvent({
      id: "ordinary",
      sourceUid: "ordinary-event",
      startTime: "2026-06-12T16:00:00.000Z",
      isInSchedule: true,
      reminderMinutes: 15,
    });
    const imported = sourceEvent({
      sourceUid: "ordinary-event",
      legacySourceUid: null,
      startTime: "2026-06-12T18:00:00.000Z",
    });
    const identity = occurrence({
      sourceUid: "ordinary-event",
      legacySourceUid: null,
      startTime: "2026-06-12T18:00:00.000Z",
      recurrenceTime: null,
    });

    const plan = planSourceReconciliation(
      [existing],
      [imported],
      snapshot([identity], [], false),
    );

    expect(plan.updates).toEqual([{ existingId: "ordinary", event: imported }]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
    expect(existing).toMatchObject({
      isInSchedule: true,
      reminderMinutes: 15,
    });
  });

  it("re-files a saved row an earlier build stored under an alarm's UID", () => {
    const parsed = parseIcs(APPLE_ALARM_ICS, { timeZone: "UTC" });

    const plan = planSourceReconciliation(
      [alarmKeyedRow()],
      toSourceEvents(parsed.events, "convention-1"),
      toSourceSnapshot(parsed, true),
    );

    // Not a removal and a fresh unsaved copy: the same row, re-filed under
    // the event's own UID with its own description, star and reminder kept.
    expect(plan.tombstones).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      {
        existingId: "saved",
        event: expect.objectContaining({
          sourceUid: "event-uid-1",
          description: "Welcome",
        }),
      },
    ]);
  });

  it("re-files it from the imported rows when the snapshot omits the previous identity", () => {
    // The import screen builds its snapshot field by field.
    const parsed = parseIcs(APPLE_ALARM_ICS, { timeZone: "UTC" });
    const full = toSourceSnapshot(parsed, true);

    const plan = planSourceReconciliation(
      [alarmKeyedRow()],
      toSourceEvents(parsed.events, "convention-1"),
      {
        ...full,
        activeOccurrences: full.activeOccurrences.map(
          ({ previousSourceUid: _, ...identity }) => identity,
        ),
      },
    );

    expect(plan.tombstones).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      {
        existingId: "saved",
        event: expect.objectContaining({ sourceUid: "event-uid-1" }),
      },
    ]);
  });

  it("moves only the identity of an unselected event stored under an alarm's UID", () => {
    const parsed = parseIcs(APPLE_ALARM_ICS, { timeZone: "UTC" });

    const plan = planSourceReconciliation(
      [alarmKeyedRow()],
      [],
      toSourceSnapshot(parsed, true),
    );

    expect(plan.identityUpdates).toEqual([
      { existingId: "saved", sourceUid: "event-uid-1" },
    ]);
    expect(plan.tombstones).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.inserts).toEqual([]);
  });

  it("does not hand one alarm UID to two events that both claim it", () => {
    // A feed reusing one alarm UID everywhere gives no way to tell which
    // event the stored row was, so it is treated as an unknown row.
    const parsed = parseIcs(
      APPLE_ALARM_ICS.replace(
        "END:VCALENDAR",
        `BEGIN:VEVENT
UID:event-uid-2
DTSTART:20260612T180000Z
SUMMARY:Second Panel
BEGIN:VALARM
UID:alarm-uid-1
ACTION:DISPLAY
TRIGGER:-PT15M
END:VALARM
END:VEVENT
END:VCALENDAR`,
      ),
      { timeZone: "UTC" },
    );

    const plan = planSourceReconciliation(
      [alarmKeyedRow()],
      toSourceEvents(parsed.events, "convention-1"),
      toSourceSnapshot(parsed, true),
    );

    expect(plan.updates).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.inserts).toHaveLength(2);
    expect(plan.tombstones).toEqual([
      { existingId: "saved", status: "removed" },
    ]);
  });

  it.each([
    ["the normalized export", normalizeEcpUids(ECP_EXPORT_ICS)],
    ["the REST expansion", ECP_REST_ICS],
  ])(
    "re-files rows stored under Events Calendar export UIDs on a URL re-import of %s",
    (_body, ics) => {
      // Without the export UID as each post's previous identity, an
      // authoritative re-import marked the saved panel removed, deleted the
      // other and inserted both again as unsaved copies.
      const parsed = parseIcs(ics);

      const plan = planSourceReconciliation(
        ecpExportKeyedRows(),
        toSourceEvents(parsed.events, "convention-1"),
        toSourceSnapshot(parsed, true),
      );

      expect(plan.tombstones).toEqual([]);
      expect(plan.removals).toEqual([]);
      expect(plan.inserts).toEqual([]);
      expect(plan.updates).toEqual([
        {
          existingId: "6569",
          event: expect.objectContaining({ sourceUid: "6569@conpaws.ecp" }),
        },
        {
          existingId: "8154",
          event: expect.objectContaining({ sourceUid: "8154@conpaws.ecp" }),
        },
      ]);
    },
  );

  it("re-files rows stored under Events Calendar export UIDs when the same file is picked again", () => {
    // A file import adds what it does not recognise, so every post used to
    // land a second time beside its stored row.
    const parsed = parseIcs(normalizeEcpUids(ECP_EXPORT_ICS));

    const plan = planSourceReconciliation(
      ecpExportKeyedRows(),
      toSourceEvents(parsed.events, "convention-1"),
      toSourceSnapshot(parsed, false),
    );

    expect(plan.inserts).toEqual([]);
    expect(plan.tombstones).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.updates.map((update) => update.existingId)).toEqual([
      "6569",
      "8154",
    ]);
  });

  it("keeps absent source rows when the snapshot is partial", () => {
    const feedEvent = storedEvent({ id: "feed" });
    const manual = storedEvent({ id: "manual", sourceUid: null });

    const plan = planSourceReconciliation(
      [feedEvent, manual],
      [],
      snapshot([], [], false),
    );

    expect(plan.updates).toEqual([]);
    expect(plan.identityUpdates).toEqual([]);
    expect(plan.inserts).toEqual([]);
    expect(plan.removals).toEqual([]);
    expect(plan.unresolvedSeries).toEqual([]);
  });
});

/**
 * Records what the transaction body writes. The drizzle expo-sqlite session
 * runs the callback inline and returns its value, so a plain object with the
 * same chained shape stands in for the real `tx`.
 */
function recordingTx(existing: ConventionEvent[]) {
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  let deletes = 0;

  const tx = {
    select: () => ({
      from: () => ({ where: () => ({ all: () => existing }) }),
    }),
    update: () => ({
      set: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { where: () => ({ run: () => undefined }) };
      },
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        inserts.push(row);
        return { run: () => undefined };
      },
    }),
    delete: () => ({
      where: () => ({
        run: () => {
          deletes++;
        },
      }),
    }),
  };

  return { tx, updates, inserts, deletes: () => deletes };
}

describe("upsertBySourceUid transaction", () => {
  beforeEach(() => {
    mockDb.transaction.mockReset();
  });

  it("preserves saved membership, reminders and personal visit times when updating a matched row", async () => {
    const starred = storedEvent({
      id: "starred",
      visitStartTime: "2026-06-12T16:30:00.000Z",
      visitEndTime: "2026-06-12T17:00:00.000Z",
      isInSchedule: true,
      reminderMinutes: 30,
      sourceUid: "panel-1",
      startTime: "2026-06-12T16:00:00.000Z",
    });
    const recorder = recordingTx([starred]);
    mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
      body(recorder.tx),
    );

    const result = await upsertBySourceUid(
      [
        sourceEvent({
          sourceUid: "panel-1",
          legacySourceUid: null,
          title: "Renamed panel",
          isInSchedule: false,
          reminderMinutes: null,
        }),
      ],
      "convention-1",
      snapshot(
        [
          occurrence({
            sourceUid: "panel-1",
            legacySourceUid: null,
            startTime: "2026-06-12T16:00:00.000Z",
            recurrenceTime: null,
          }),
        ],
        [],
        true,
      ),
    );

    expect(result.updated).toBe(1);
    expect(recorder.updates).toHaveLength(1);

    const payload = recorder.updates[0];
    expect(payload.title).toBe("Renamed panel");
    // The star and the reminder are the user's, not the feed's. Adding a
    // spread of the source row here would clear both on every re-import and
    // the reconciliation tests above would stay green.
    expect(Object.keys(payload)).not.toContain("isInSchedule");
    expect(Object.keys(payload)).not.toContain("reminderMinutes");
    expect(Object.keys(payload)).not.toContain("visitStartTime");
    expect(Object.keys(payload)).not.toContain("visitEndTime");
  });

  it("leaves a row the feed republished unchanged untouched, updatedAt included", async () => {
    const unchanged = storedEvent({
      id: "unchanged",
      sourceUid: "panel-1",
      title: "Same panel",
      room: "Room A",
      startTime: "2026-06-12T16:00:00.000Z",
      endTime: "2026-06-12T17:00:00.000Z",
    });
    const tombstoned = storedEvent({
      id: "tombstoned",
      sourceUid: "panel-2",
      title: "Back again",
      room: "Room A",
      startTime: "2026-06-12T18:00:00.000Z",
      endTime: "2026-06-12T19:00:00.000Z",
      feedStatus: "removed",
    });
    const recorder = recordingTx([unchanged, tombstoned]);
    mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
      body(recorder.tx),
    );
    const republished = (row: ConventionEvent) =>
      sourceEvent({
        sourceUid: row.sourceUid,
        legacySourceUid: null,
        title: row.title,
        room: row.room,
        startTime: row.startTime,
        endTime: row.endTime,
      });
    const identity = (row: ConventionEvent) =>
      occurrence({
        sourceUid: row.sourceUid ?? "",
        legacySourceUid: null,
        startTime: row.startTime,
        recurrenceTime: null,
        title: row.title,
      });

    const result = await upsertBySourceUid(
      [republished(unchanged), republished(tombstoned)],
      "convention-1",
      snapshot([identity(unchanged), identity(tombstoned)], [], true),
    );

    // Still counted as matched, but only the row whose mark clears is written.
    expect(result.updated).toBe(2);
    expect(recorder.updates).toHaveLength(1);
    expect(recorder.updates[0]).toMatchObject({
      title: "Back again",
      feedStatus: null,
      updatedAt: expect.any(String),
    });
  });

  it("does not carry legacySourceUid into an inserted row", async () => {
    const recorder = recordingTx([]);
    mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
      body(recorder.tx),
    );

    const result = await upsertBySourceUid(
      [sourceEvent({ sourceUid: "brand-new", legacySourceUid: "legacy-uid" })],
      "convention-1",
      snapshot(),
    );

    expect(result.added).toBe(1);
    expect(recorder.inserts).toHaveLength(1);
    expect(Object.keys(recorder.inserts[0])).not.toContain("legacySourceUid");
    expect(recorder.inserts[0].sourceUid).toBe("brand-new");
    expect(recorder.inserts[0].id).toEqual(expect.any(String));
  });

  it("re-files a saved alarm-keyed row in place: no tombstone, no insert", async () => {
    const recorder = recordingTx([alarmKeyedRow()]);
    mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
      body(recorder.tx),
    );
    const parsed = parseIcs(APPLE_ALARM_ICS, { timeZone: "UTC" });

    const result = await upsertBySourceUid(
      toSourceEvents(parsed.events, "convention-1"),
      "convention-1",
      toSourceSnapshot(parsed, true),
    );

    expect(result).toMatchObject({
      added: 0,
      updated: 1,
      removedEventIds: [],
      tombstonedEventIds: [],
    });
    expect(recorder.inserts).toEqual([]);
    expect(recorder.updates).toEqual([
      expect.objectContaining({
        sourceUid: "event-uid-1",
        description: "Welcome",
        feedStatus: null,
      }),
    ]);
  });

  it("re-files saved Events Calendar export rows in place: no tombstone, no insert", async () => {
    const recorder = recordingTx(ecpExportKeyedRows());
    mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
      body(recorder.tx),
    );
    const parsed = parseIcs(normalizeEcpUids(ECP_EXPORT_ICS));

    const result = await upsertBySourceUid(
      toSourceEvents(parsed.events, "convention-1"),
      "convention-1",
      toSourceSnapshot(parsed, true),
    );

    expect(result).toMatchObject({
      added: 0,
      updated: 2,
      removedEventIds: [],
      tombstonedEventIds: [],
    });
    expect(recorder.inserts).toEqual([]);
    // Only the identity moves; the star and reminder stay on the same rows.
    expect(recorder.updates).toEqual([
      expect.objectContaining({ sourceUid: "6569@conpaws.ecp" }),
      expect.objectContaining({ sourceUid: "8154@conpaws.ecp" }),
    ]);
    for (const payload of recorder.updates) {
      expect(Object.keys(payload)).not.toContain("isInSchedule");
      expect(Object.keys(payload)).not.toContain("reminderMinutes");
    }
  });

  it("does not carry previousSourceUid into an inserted row", async () => {
    const recorder = recordingTx([]);
    mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
      body(recorder.tx),
    );

    await upsertBySourceUid(
      [
        sourceEvent({
          sourceUid: "brand-new",
          legacySourceUid: null,
          previousSourceUid: "alarm-uid",
        }),
      ],
      "convention-1",
      snapshot(),
    );

    expect(recorder.inserts).toHaveLength(1);
    expect(Object.keys(recorder.inserts[0])).not.toContain("previousSourceUid");
  });

  it("deletes exactly the rows the plan removed", async () => {
    const gone = storedEvent({
      id: "gone",
      sourceUid: "dropped-panel",
      isInSchedule: false,
    });
    const recorder = recordingTx([gone]);
    mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
      body(recorder.tx),
    );

    const result = await upsertBySourceUid([], "convention-1", snapshot());

    expect(result.removedEventIds).toEqual(["gone"]);
    expect(recorder.deletes()).toBe(1);
  });
});

describe("getAllInSchedule", () => {
  it("leaves out saved events from an archived convention", async () => {
    const { database, store } = migratedStore();
    database.exec(`
      INSERT INTO conventions (id, name, start_date, end_date, archived_at)
      VALUES
        ('attending', 'Attending Con', '2026-12-01', '2026-12-03', NULL),
        ('archived', 'Archived Con', '2026-12-10', '2026-12-12',
          '2026-11-20T00:00:00.000Z');
      INSERT INTO convention_events
        (id, convention_id, title, start_time, is_in_schedule, reminder_minutes)
      VALUES
        ('kept', 'attending', 'Kept', '2026-12-01T15:00:00Z', 1, 15),
        ('unsaved', 'attending', 'Unsaved', '2026-12-01T16:00:00Z', 0, NULL),
        ('hidden', 'archived', 'Hidden', '2026-12-10T15:00:00Z', 1, 15);
    `);
    mockDb.select.mockImplementation(store.select.bind(store));

    const rows = await getAllInSchedule();

    // Archiving cancels the reminders and refuses tracking, so the archived
    // convention's saved panels must leave the Schedule tab too, or it lists
    // a plan with reminder chips that will never fire.
    expect(rows.map((row) => row.event.id)).toEqual(["kept"]);
    expect(rows[0]).toMatchObject({
      conventionName: "Attending Con",
      event: { isInSchedule: true, reminderMinutes: 15 },
    });
    database.close();
  });
});

it("clears visit and reminder intent only for rows removed by a compare choice", async () => {
  const recorder = recordingTx([]);
  mockDb.transaction.mockImplementation((body: (tx: unknown) => unknown) =>
    body(recorder.tx),
  );
  await setScheduleMembership([
    { id: "visit", isInSchedule: false },
    { id: "timed", isInSchedule: true },
  ]);
  expect(recorder.updates).toHaveLength(2);
  expect(recorder.updates[0]).toMatchObject({
    isInSchedule: false,
    reminderMinutes: null,
    visitStartTime: null,
    visitEndTime: null,
  });
  expect(recorder.updates[1]).toMatchObject({ isInSchedule: true });
  expect(recorder.updates[1]).not.toHaveProperty("visitStartTime");
  expect(recorder.updates[1]).not.toHaveProperty("reminderMinutes");
});
