import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "../schema";
import {
  planSourceReconciliation,
  type SourceEventInput,
  type SourceOccurrenceIdentity,
  type SourceSnapshot,
  upsertBySourceUid,
} from "./events";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { transaction: vi.fn() },
}));

vi.mock("../index", () => ({ db: mockDb }));

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

  it("never writes isInSchedule or reminderMinutes when updating a matched row", async () => {
    const starred = storedEvent({
      id: "starred",
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
