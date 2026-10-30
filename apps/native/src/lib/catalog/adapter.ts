import type { SourceSnapshot } from "@/db/repositories/events";
import {
  conventionDayKey,
  conventionStatusForDay,
  fromConventionTime,
  isValidTimeZone,
} from "@/lib/convention-time";
import type { ParsedEvent } from "@/lib/ical-parser";
import type { ConventionDraft } from "@/services/convention-commit";
import type { CatalogEdition, CatalogSchedule, CatalogSession } from "./types";
import { isValidCatalogSessionTime } from "./types";

export function editionToDraft(edition: CatalogEdition): ConventionDraft {
  const today = conventionDayKey(new Date(), edition.timezone);
  return {
    name: edition.name,
    startDate: edition.startsOn,
    endDate: edition.endsOn,
    timeZone: edition.timezone,
    location: [edition.venue, edition.city].filter(Boolean).join(" · "),
    icalUrl: null,
    status: conventionStatusForDay(edition.startsOn, edition.endsOn, today),
    catalogSlug: edition.slug,
    catalogRevision: edition.revision,
  };
}

function sessionInstant(value: string, timezone: string): Date | null {
  if (!isValidCatalogSessionTime(value, timezone)) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const [hour, minute] = value.slice(11).split(":").map(Number);
  return fromConventionTime({ year, month, day, hour, minute }, timezone);
}

function sourceOccurrence(
  session: CatalogSession,
  startTime: Date,
  sourceUrl: string,
) {
  return {
    sourceUid: session.id,
    legacySourceUid: null,
    startTime: startTime.toISOString(),
    recurrenceTime: null,
    title: session.title,
    sourceUrl,
  };
}

export function sessionsToImport(
  edition: CatalogEdition | CatalogSchedule,
  options: { scheduleUrl: string },
): { parsedEvents: ParsedEvent[]; sourceSnapshot: SourceSnapshot } {
  const parsedEvents: ParsedEvent[] = [];
  const activeOccurrences: SourceSnapshot["activeOccurrences"] = [];
  const cancelledOccurrences: SourceSnapshot["cancelledOccurrences"] = [];
  const timezone = edition.timezone;
  if (!isValidTimeZone(timezone)) {
    return {
      parsedEvents,
      sourceSnapshot: {
        activeOccurrences,
        cancelledOccurrences,
        authoritative: true,
      },
    };
  }

  for (const session of edition.sessions) {
    const startTime = sessionInstant(session.startsAt, timezone);
    if (!startTime) continue;
    const parsedEnd = sessionInstant(session.endsAt, timezone);
    const endTime = parsedEnd && parsedEnd >= startTime ? parsedEnd : null;
    const occurrence = sourceOccurrence(
      session,
      startTime,
      options.scheduleUrl,
    );

    if (session.status === "cancelled") {
      cancelledOccurrences.push(occurrence);
      continue;
    }

    activeOccurrences.push(occurrence);
    parsedEvents.push({
      title: session.title,
      description: session.description || null,
      startTime,
      endTime,
      location: null,
      room: session.room || null,
      category: null,
      categories: [],
      ageRating: null,
      sourceUid: session.id,
      legacySourceUid: null,
      recurrenceTime: null,
      sourceUrl: options.scheduleUrl,
      isAgeRestricted: false,
      contentWarning: false,
      isAllDay: false,
    });
  }

  return {
    parsedEvents,
    sourceSnapshot: {
      activeOccurrences,
      cancelledOccurrences,
      authoritative: true,
    },
  };
}

export function catalogEditionSummary(
  edition: CatalogEdition,
  now: Date,
): { isPast: boolean; scheduleReady: boolean; sessionCount: number } {
  return {
    isPast: edition.endsOn < conventionDayKey(now, edition.timezone),
    scheduleReady: edition.scheduleStatus !== "not-released",
    sessionCount: edition.sessions.length,
  };
}
