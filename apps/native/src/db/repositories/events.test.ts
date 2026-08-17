import { describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "../schema";
import {
  planSourceReconciliation,
  type SourceEventInput,
  type SourceOccurrenceIdentity,
  type SourceSnapshot,
} from "./events";

vi.mock("../index", () => ({ db: {} }));

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
    contentWarning: false,
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
    contentWarning: false,
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
    expect(plan.removals.map((event) => event.id).sort()).toEqual([
      "cancelled",
      "missing",
    ]);
  });

  it("keeps unrelated feed rows for a partial local file while applying explicit cancellations", () => {
    const unrelated = storedEvent({
      id: "unrelated",
      sourceUid: "another-feed-event",
    });
    const cancelled = storedEvent({
      id: "cancelled",
      sourceUid: "cancelled-event",
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
    const bare = storedEvent({ id: "bare" });
    const composite = storedEvent({
      id: "composite",
      sourceUid: "recurring-event|20260612T160000Z",
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
