import type {
  SourceEventInput,
  SourceSnapshot,
} from "@/db/repositories/events";
import type { ParsedEvent, ParseResult } from "@/lib/ical-parser";

/**
 * The two mechanical translations from "what the parser produced" to "what the
 * repository reconciles against".
 *
 * Both lived inline until an update check needed them too — the import screen
 * built the snapshot, the import hook built the rows. Sharing them is what lets
 * a pre-import summary promise the same numbers the import itself will produce;
 * two hand-kept copies would drift and the preview would start lying.
 */

/**
 * Rows to write for the events the user chose to import.
 *
 * `isInSchedule` and `reminderMinutes` are only ever read on the INSERT path —
 * `upsertBySourceUid`'s UPDATE SET list omits both, so a re-import never
 * clobbers a star or a saved reminder. The `false`/`null` here are the defaults
 * for a genuinely new row, not a reset.
 */
export function toSourceEvents(
  events: readonly ParsedEvent[],
  conventionId: string,
): SourceEventInput[] {
  return events.map((event) => ({
    conventionId,
    title: event.title,
    description: event.description,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime?.toISOString() ?? null,
    location: event.location,
    room: event.room,
    category: event.category,
    type: null,
    isInSchedule: false,
    reminderMinutes: null,
    sourceUid: event.sourceUid,
    legacySourceUid: event.legacySourceUid,
    sourceUrl: event.sourceUrl,
    isAgeRestricted: event.isAgeRestricted,
    ageRating: event.ageRating,
    contentWarning: event.contentWarning,
  }));
}

/**
 * What the feed said, which is a different question from what the user picked.
 *
 * The snapshot always describes every occurrence in the feed, never the
 * category-filtered subset — that separation is what stops deselecting a
 * category from reading as "these events were removed from the schedule".
 *
 * `authoritative` is the master switch for destructive reconciliation, and it
 * is true only for a feed we can re-fetch. A file import can add and update but
 * must never conclude that a missing event was cancelled: the user may simply
 * have picked an older export.
 */
export function toSourceSnapshot(
  parsed: ParseResult,
  authoritative: boolean,
): SourceSnapshot {
  return {
    authoritative,
    activeOccurrences: parsed.events.map((event) => ({
      sourceUid: event.sourceUid,
      legacySourceUid: event.legacySourceUid,
      startTime: event.startTime.toISOString(),
      recurrenceTime: event.recurrenceTime?.toISOString() ?? null,
      title: event.title,
      sourceUrl: event.sourceUrl,
    })),
    cancelledOccurrences: parsed.cancelledEvents.map((event) => ({
      sourceUid: event.sourceUid,
      legacySourceUid: event.legacySourceUid,
      startTime: event.startTime?.toISOString() ?? null,
      recurrenceTime: event.recurrenceTime?.toISOString() ?? null,
      title: event.title,
      sourceUrl: event.sourceUrl,
    })),
  };
}
