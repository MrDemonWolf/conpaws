import type { SourceSnapshot } from "@/db/repositories/events";
import type { ImportInput, ImportResult } from "@/hooks/useImportSchedule";
import {
  conventionDayKey,
  conventionStatusForDay,
} from "@/lib/convention-time";
import type { ParsedEvent } from "@/lib/ical-parser";
import type {
  ConventionDraft,
  ConventionPatch,
} from "@/services/convention-commit";

/**
 * The write half of a schedule import, lifted out of the import screen.
 *
 * The screen owns everything that talks to the user: picking a file, parsing,
 * choosing categories and confirming a schedule that has emptied out. What is
 * left here is the part where order matters and a partial failure has to be
 * survivable, which is exactly the part a route component made impossible to
 * test.
 *
 * Two orderings are load-bearing. The convention row is re-dated before the
 * widget snapshot is rebuilt, because the widget reads that row. And a
 * convention this import created is only rolled back while the events have not
 * landed yet; once they have, removing it would delete them too.
 */

/** The dates and status an imported schedule implies for its convention. */
export interface ImportedConventionDates {
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "ended";
}

export type ScheduleImportCommitOutcome =
  | {
      ok: true;
      result: ImportResult;
      /** Set when this import created the convention it wrote into. */
      createdConventionId: string | null;
      /**
       * False when the events landed but the convention's own dates, time zone
       * or feed URL could not be rewritten. The import still counts.
       */
      conventionDetailsUpdated: boolean;
    }
  | { ok: false; reason: "import-failed" };

export interface ScheduleImportCommitInput {
  /** `"new"` when this import is also creating the convention. */
  conventionId: string;
  /** Read only when `conventionId` is `"new"`; a null draft aborts the commit. */
  draft: ConventionDraft | null;
  parsedEvents: ParsedEvent[];
  sourceSnapshot: SourceSnapshot;
  /** Applied to an existing convention once its events are in. */
  patch: ConventionPatch;
}

export interface ScheduleImportCommitDeps {
  createConvention: (draft: ConventionDraft) => Promise<{ id: string }>;
  removeConvention: (conventionId: string) => Promise<void>;
  importEvents: (input: ImportInput) => Promise<ImportResult>;
  updateConvention: (
    conventionId: string,
    patch: ConventionPatch,
  ) => Promise<void>;
  publishSnapshot: () => Promise<unknown>;
  refreshCaches: (conventionId: string) => Promise<unknown>;
  haptic: () => void;
}

/**
 * Spans the imported events, in the convention's own time zone.
 *
 * Returns null for a schedule with no active events: there is nothing to date
 * the convention from, and guessing would move a convention the user set by
 * hand. Reducing rather than spreading into `Math.min` keeps a schedule with
 * tens of thousands of events off the argument limit.
 */
export function deriveImportedConventionDates(
  events: readonly { startTime: Date }[],
  timeZone: string,
  now: Date,
): ImportedConventionDates | null {
  if (events.length === 0) return null;

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    const time = event.startTime.getTime();
    if (time < earliest) earliest = time;
    if (time > latest) latest = time;
  }

  const startDate = conventionDayKey(new Date(earliest), timeZone);
  const endDate = conventionDayKey(new Date(latest), timeZone);
  return {
    startDate,
    endDate,
    status: conventionStatusForDay(
      startDate,
      endDate,
      conventionDayKey(now, timeZone),
    ),
  };
}

/**
 * The patch an import applies to a convention that already exists.
 *
 * A schedule that produced no dates still moves the time zone, because the
 * user picked it on this screen. The feed URL is only written when the import
 * came from one, so importing a file does not blank the stored URL.
 */
export function buildImportedConventionPatch(input: {
  dates: ImportedConventionDates | null;
  sourceUrl: string | null;
  timeZone: string;
}): ConventionPatch {
  return {
    ...(input.dates ?? {}),
    ...(input.sourceUrl ? { icalUrl: input.sourceUrl } : {}),
    timeZone: input.timeZone,
  };
}

/**
 * Writes an imported schedule, creating its convention first when there is not
 * one yet.
 *
 * Resolves only once the snapshot has been rebuilt, so a caller that announces
 * the import on the result cannot report success while the widget still shows
 * the schedule this import replaced.
 */
export async function commitScheduleImport(
  input: ScheduleImportCommitInput,
  deps: ScheduleImportCommitDeps,
): Promise<ScheduleImportCommitOutcome> {
  let createdConventionId: string | null = null;
  let shouldRollbackCreatedConvention = false;

  try {
    let conventionId = input.conventionId;
    if (conventionId === "new") {
      if (!input.draft) {
        throw new Error("A new convention needs at least one active event");
      }
      const convention = await deps.createConvention(input.draft);
      conventionId = convention.id;
      createdConventionId = convention.id;
      shouldRollbackCreatedConvention = true;
    }

    const result = await deps.importEvents({
      parsedEvents: input.parsedEvents,
      conventionId,
      sourceSnapshot: input.sourceSnapshot,
    });
    // The events are in the convention now, so removing it would take them
    // with it. Nothing after this point is worth rolling back.
    shouldRollbackCreatedConvention = false;

    let conventionDetailsUpdated = true;
    // A convention created a moment ago was written from this same schedule,
    // so there is nothing left to bring into line with it.
    if (!createdConventionId) {
      try {
        await deps.updateConvention(conventionId, input.patch);
      } catch {
        conventionDetailsUpdated = false;
      }
      if (conventionDetailsUpdated) {
        await deps.publishSnapshot().catch(() => false);
      }
    }

    await deps.refreshCaches(conventionId);
    deps.haptic();

    return { ok: true, result, createdConventionId, conventionDetailsUpdated };
  } catch {
    if (createdConventionId && shouldRollbackCreatedConvention) {
      try {
        await deps.removeConvention(createdConventionId);
      } catch {
        // The original import failure is still the useful thing to report.
      }
    }
    return { ok: false, reason: "import-failed" };
  }
}
