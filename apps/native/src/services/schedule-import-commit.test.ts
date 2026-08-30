import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));

import type { SourceSnapshot } from "@/db/repositories/events";
import type { ImportResult } from "@/hooks/useImportSchedule";
import type { ParsedEvent } from "@/lib/ical-parser";
import {
  buildImportedConventionPatch,
  commitScheduleImport,
  deriveImportedConventionDates,
  type ScheduleImportCommitInput,
} from "./schedule-import-commit";

/**
 * These replace the half of a source lint that read the import route looking
 * for `publishWidgetSnapshot` between the convention update and the success
 * alert. The ordering that stayed in the route -- the alert firing only after
 * the commit -- is now guaranteed by the `await` rather than by where the call
 * sits in the file.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const IMPORT_RESULT: ImportResult = {
  added: 3,
  updated: 1,
  unresolved: 0,
  removed: 2,
  tombstoned: 0,
  remindersCleared: 0,
  remindersPaused: 0,
};

const SOURCE_SNAPSHOT: SourceSnapshot = {
  authoritative: true,
  activeOccurrences: [],
  cancelledOccurrences: [],
};

const parsedEvents = [] as ParsedEvent[];

function input(
  overrides: Partial<ScheduleImportCommitInput> = {},
): ScheduleImportCommitInput {
  return {
    conventionId: "conv_1",
    draft: null,
    parsedEvents,
    sourceSnapshot: SOURCE_SNAPSHOT,
    patch: { timeZone: "America/Chicago" },
    ...overrides,
  };
}

function commitDeps() {
  return {
    createConvention: vi.fn(async () => ({ id: "conv_new" })),
    removeConvention: vi.fn(async () => undefined),
    importEvents: vi.fn(async () => IMPORT_RESULT),
    updateConvention: vi.fn(async () => undefined),
    publishSnapshot: vi.fn(async () => true),
    refreshCaches: vi.fn(async () => undefined),
    haptic: vi.fn(),
  };
}

/** First invocation index of a mock, for cross-mock ordering comparisons. */
function firstCall(mock: { mock: { invocationCallOrder: number[] } }): number {
  const [order] = mock.mock.invocationCallOrder;
  expect(order).toBeDefined();
  return order as number;
}

function at(iso: string): { startTime: Date } {
  return { startTime: new Date(iso) };
}

describe("deriveImportedConventionDates", () => {
  it("returns null for a schedule with no events", () => {
    expect(
      deriveImportedConventionDates([], "America/Chicago", new Date()),
    ).toBeNull();
  });

  it("spans the earliest and latest event in the convention time zone", () => {
    // The last event starts at 22:30 Chicago time, which is already the next
    // day in UTC. Reading the span in the convention's zone is what keeps the
    // end date on the day the schedule actually ends.
    const dates = deriveImportedConventionDates(
      [
        at("2026-08-22T18:00:00Z"),
        at("2026-08-21T14:00:00Z"),
        at("2026-08-23T03:30:00Z"),
      ],
      "America/Chicago",
      new Date("2026-08-22T12:00:00Z"),
    );

    expect(dates).toEqual({
      startDate: "2026-08-21",
      endDate: "2026-08-22",
      status: "active",
    });
  });

  it("dates a schedule that has not started yet as upcoming", () => {
    expect(
      deriveImportedConventionDates(
        [at("2026-08-21T14:00:00Z")],
        "America/Chicago",
        new Date("2026-01-01T12:00:00Z"),
      )?.status,
    ).toBe("upcoming");
  });

  it("dates a schedule that has finished as ended", () => {
    expect(
      deriveImportedConventionDates(
        [at("2026-08-21T14:00:00Z")],
        "America/Chicago",
        new Date("2027-01-01T12:00:00Z"),
      )?.status,
    ).toBe("ended");
  });
});

describe("buildImportedConventionPatch", () => {
  it("rewrites the dates, status, feed and time zone of a fetched schedule", () => {
    expect(
      buildImportedConventionPatch({
        dates: {
          startDate: "2026-08-21",
          endDate: "2026-08-23",
          status: "upcoming",
        },
        sourceUrl: "https://example.test/schedule.ics",
        timeZone: "America/Chicago",
      }),
    ).toEqual({
      startDate: "2026-08-21",
      endDate: "2026-08-23",
      status: "upcoming",
      icalUrl: "https://example.test/schedule.ics",
      timeZone: "America/Chicago",
    });
  });

  it("leaves a stored feed URL alone when the schedule came from a file", () => {
    // A file import has no URL of its own, and writing null here would silently
    // detach a convention from the feed it was set up to refresh from.
    const patch = buildImportedConventionPatch({
      dates: null,
      sourceUrl: null,
      timeZone: "America/Chicago",
    });

    expect(patch).toEqual({ timeZone: "America/Chicago" });
    expect("icalUrl" in patch).toBe(false);
  });
});

describe("commitScheduleImport", () => {
  it("publishes the snapshot after the convention row is re-dated", async () => {
    const deps = commitDeps();

    const outcome = await commitScheduleImport(input(), deps);

    expect(outcome).toEqual({
      ok: true,
      result: IMPORT_RESULT,
      createdConventionId: null,
      conventionDetailsUpdated: true,
    });
    expect(deps.importEvents).toHaveBeenCalledWith({
      parsedEvents,
      conventionId: "conv_1",
      sourceSnapshot: SOURCE_SNAPSHOT,
    });
    expect(firstCall(deps.updateConvention)).toBeGreaterThan(
      firstCall(deps.importEvents),
    );
    expect(firstCall(deps.publishSnapshot)).toBeGreaterThan(
      firstCall(deps.updateConvention),
    );
    expect(firstCall(deps.refreshCaches)).toBeGreaterThan(
      firstCall(deps.publishSnapshot),
    );
    expect(firstCall(deps.haptic)).toBeGreaterThan(
      firstCall(deps.refreshCaches),
    );
  });

  it("does not publish a snapshot while the convention update is in flight", async () => {
    const gate = deferred<undefined>();
    const deps = commitDeps();
    deps.updateConvention.mockReturnValueOnce(gate.promise);

    const pending = commitScheduleImport(input(), deps);
    await Promise.resolve();
    expect(deps.publishSnapshot).not.toHaveBeenCalled();

    gate.resolve(undefined);
    await pending;
    expect(deps.publishSnapshot).toHaveBeenCalledTimes(1);
  });

  it("skips the snapshot but keeps the import when the row cannot be re-dated", async () => {
    // The events landed. Republishing from a convention row that still holds
    // the old dates would put a schedule and a date range that disagree in
    // front of the user on the Home Screen.
    const deps = commitDeps();
    deps.updateConvention.mockRejectedValueOnce(new Error("locked"));

    const outcome = await commitScheduleImport(input(), deps);

    expect(outcome).toMatchObject({
      ok: true,
      conventionDetailsUpdated: false,
    });
    expect(deps.publishSnapshot).not.toHaveBeenCalled();
    expect(deps.refreshCaches).toHaveBeenCalledWith("conv_1");
  });

  it("creates the convention first when the import is starting one", async () => {
    const deps = commitDeps();
    const draft = {
      name: "Example Con",
      startDate: "2026-08-21",
      endDate: "2026-08-23",
      timeZone: "America/Indiana/Indianapolis",
      icalUrl: null,
      status: "upcoming" as const,
    };

    const outcome = await commitScheduleImport(
      input({ conventionId: "new", draft }),
      deps,
    );

    expect(outcome).toMatchObject({
      ok: true,
      createdConventionId: "conv_new",
      conventionDetailsUpdated: true,
    });
    expect(deps.createConvention).toHaveBeenCalledWith(draft);
    expect(firstCall(deps.importEvents)).toBeGreaterThan(
      firstCall(deps.createConvention),
    );
    expect(deps.importEvents).toHaveBeenCalledWith(
      expect.objectContaining({ conventionId: "conv_new" }),
    );
    // The convention was written from this same schedule a moment ago, so
    // there is nothing left to bring into line with it.
    expect(deps.updateConvention).not.toHaveBeenCalled();
    expect(deps.publishSnapshot).not.toHaveBeenCalled();
  });

  it("refuses to start a convention it has no dates for", async () => {
    const deps = commitDeps();

    const outcome = await commitScheduleImport(
      input({ conventionId: "new", draft: null }),
      deps,
    );

    expect(outcome).toEqual({ ok: false, reason: "import-failed" });
    expect(deps.createConvention).not.toHaveBeenCalled();
    expect(deps.importEvents).not.toHaveBeenCalled();
    expect(deps.removeConvention).not.toHaveBeenCalled();
  });

  it("removes a convention it created when the events fail to land", async () => {
    const deps = commitDeps();
    deps.importEvents.mockRejectedValueOnce(new Error("batch failed"));

    const outcome = await commitScheduleImport(
      input({ conventionId: "new", draft: { name: "X" } as never }),
      deps,
    );

    expect(outcome).toEqual({ ok: false, reason: "import-failed" });
    expect(deps.removeConvention).toHaveBeenCalledWith("conv_new");
  });

  it("keeps a convention it created once the events are in", async () => {
    // Rolling back here would delete the events along with the convention, so
    // a failure after the write is reported and nothing else.
    const deps = commitDeps();
    deps.refreshCaches.mockRejectedValueOnce(new Error("cache is gone"));

    const outcome = await commitScheduleImport(
      input({ conventionId: "new", draft: { name: "X" } as never }),
      deps,
    );

    expect(outcome).toEqual({ ok: false, reason: "import-failed" });
    expect(deps.removeConvention).not.toHaveBeenCalled();
  });

  it("never removes a convention it did not create", async () => {
    const deps = commitDeps();
    deps.importEvents.mockRejectedValueOnce(new Error("batch failed"));

    const outcome = await commitScheduleImport(input(), deps);

    expect(outcome).toEqual({ ok: false, reason: "import-failed" });
    expect(deps.removeConvention).not.toHaveBeenCalled();
  });

  it("reports the import even when the snapshot cannot be published", async () => {
    const deps = commitDeps();
    deps.publishSnapshot.mockRejectedValueOnce(new Error("no app group"));

    await expect(commitScheduleImport(input(), deps)).resolves.toMatchObject({
      ok: true,
      conventionDetailsUpdated: true,
    });
  });
});
