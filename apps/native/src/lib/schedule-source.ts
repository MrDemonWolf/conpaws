import type {
  SourceEventInput,
  SourceSnapshot,
} from "@/db/repositories/events";
import { ecpUidForExportUid } from "@/lib/ecp-feed";
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
    previousSourceUid: event.previousSourceUid,
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
      previousSourceUid: event.previousSourceUid,
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

/**
 * Stored identities an earlier build gave a feed event, mapped to the one the
 * feed gives it now. The change check and the import planner both read
 * stored rows through this, so they agree on which row is which event.
 *
 * Without it, rows saved under an Apple alarm's UID (see
 * `ParsedEvent.previousSourceUid`) matched nothing: the check called the feed
 * untrusted on every pass, and an import marked each saved row removed and
 * added an unsaved copy beside it.
 *
 * Rows an earlier build stored under an Events Calendar export's own UID are
 * the same case, read from the stored side so it holds whether the feed came
 * from the normalized export or the REST expansion: see `ecpUidForExportUid`.
 *
 * Adopted only when unambiguous: exactly one feed event claims the old
 * identity, a stored row holds it, no stored row holds the event's current
 * identity yet, and the feed does not publish the old one as its own. An
 * export UID is also passed over when another stored one shares its post id.
 */
export function adoptPreviousSourceUids(
  storedSourceUids: ReadonlySet<string>,
  feed: Iterable<{
    sourceUid: string | null;
    previousSourceUid?: string | null;
  }>,
  publishedSourceUids: ReadonlySet<string>,
): Map<string, string> {
  // A post's current identity to the one stored export UID behind it, or null
  // once two share a post id, as a recurring post's occurrences do.
  const exportUidByEcpUid = new Map<string, string | null>();
  for (const stored of storedSourceUids) {
    const ecpUid = ecpUidForExportUid(stored);
    if (ecpUid === null) continue;
    exportUidByEcpUid.set(
      ecpUid,
      exportUidByEcpUid.has(ecpUid) ? null : stored,
    );
  }

  // Old identity to the event claiming it, or null once two events claim it.
  const claims = new Map<string, string | null>();
  const claim = (sourceUid: string, previous: string | null | undefined) => {
    if (
      !previous ||
      previous === sourceUid ||
      !storedSourceUids.has(previous) ||
      storedSourceUids.has(sourceUid) ||
      publishedSourceUids.has(previous)
    ) {
      return;
    }
    const claimed = claims.get(previous);
    claims.set(
      previous,
      claimed === undefined || claimed === sourceUid ? sourceUid : null,
    );
  };
  for (const { sourceUid, previousSourceUid } of feed) {
    if (!sourceUid) continue;
    claim(sourceUid, previousSourceUid);
    claim(sourceUid, exportUidByEcpUid.get(sourceUid));
  }

  const adopted = new Map<string, string>();
  for (const [previous, current] of claims) {
    if (current !== null) adopted.set(previous, current);
  }
  return adopted;
}
