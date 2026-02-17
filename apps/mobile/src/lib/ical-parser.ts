import ICAL from "ical.js";
import type { NewConventionEvent } from "@/types";

export interface ParsedCalendar {
  name: string;
  description?: string;
  events: ParsedEvent[];
  startDate: string;
  endDate: string;
}

export interface ParsedEvent {
  uid: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  room: string | null;
  category: string | null;
  sourceUrl: string | null;
  isAgeRestricted: boolean;
  contentWarning: string | null;
}

const AGE_RESTRICTED_PATTERNS = [
  /18\+/i,
  /adults?.only/i,
  /\bID required\b/i,
  /\bafter dark\b/i,
  /\bmurrsuit/i,
];

const CONTENT_WARNING_PATTERNS = [
  {
    pattern: /strobe\s*(effects?|lights?|lighting)/i,
    warning: "Strobe effects",
  },
  {
    pattern: /flash(ing)?\s*lights?/i,
    warning: "Flashing lights",
  },
  {
    pattern: /fog\s*effects?/i,
    warning: "Fog effects",
  },
  {
    pattern: /epilepsy/i,
    warning: "Epilepsy risk",
  },
];

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLocation(location: string | null): {
  room: string | null;
  venue: string | null;
} {
  if (!location) return { room: null, venue: null };

  const parts = location.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    return { room: parts[0], venue: parts.slice(1).join(", ") };
  }
  return { room: location, venue: null };
}

function detectAgeRestriction(text: string): boolean {
  return AGE_RESTRICTED_PATTERNS.some((p) => p.test(text));
}

function detectContentWarnings(text: string): string | null {
  const warnings = CONTENT_WARNING_PATTERNS.filter((cw) =>
    cw.pattern.test(text),
  ).map((cw) => cw.warning);

  return warnings.length > 0 ? warnings.join(", ") : null;
}

export function parseICalContent(icsContent: string): ParsedCalendar {
  const jcal = ICAL.parse(icsContent);
  const comp = new ICAL.Component(jcal);

  const calName =
    comp.getFirstPropertyValue("x-wr-calname") ??
    comp.getFirstPropertyValue("prodid") ??
    "Imported Convention";

  const calDesc = comp.getFirstPropertyValue("x-wr-caldesc") ?? undefined;

  const vevents = comp.getAllSubcomponents("vevent");
  const events: ParsedEvent[] = [];
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);
    const title = event.summary ?? "Untitled Event";
    const rawDescription = event.description ?? "";
    const description = decodeHtmlEntities(rawDescription);
    const rawLocation = event.location ?? null;
    const { room, venue } = parseLocation(rawLocation);
    const category =
      vevent.getFirstPropertyValue("categories") ?? null;
    const uid = event.uid ?? "";
    const url = vevent.getFirstPropertyValue("url") ?? null;

    const startDate = event.startDate?.toJSDate();
    const endDate = event.endDate?.toJSDate();

    if (!startDate || !endDate) continue;

    if (!earliest || startDate < earliest) earliest = startDate;
    if (!latest || endDate > latest) latest = endDate;

    const fullText = `${title} ${description}`;
    const isAgeRestricted = detectAgeRestriction(fullText);
    const contentWarning = detectContentWarnings(fullText);

    events.push({
      uid,
      title,
      description: description || null,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      location: venue ?? rawLocation,
      room,
      category,
      sourceUrl: url,
      isAgeRestricted,
      contentWarning,
    });
  }

  return {
    name: decodeHtmlEntities(calName),
    description: calDesc ? decodeHtmlEntities(calDesc) : undefined,
    events: events.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    startDate: earliest?.toISOString() ?? new Date().toISOString(),
    endDate: latest?.toISOString() ?? new Date().toISOString(),
  };
}

export function parsedEventsToNewEvents(
  conventionId: string,
  events: ParsedEvent[],
): Omit<NewConventionEvent, "id" | "createdAt" | "updatedAt">[] {
  return events.map((e) => ({
    conventionId,
    title: e.title,
    description: e.description,
    startTime: e.startTime,
    endTime: e.endTime,
    location: e.location,
    room: e.room,
    category: e.category,
    type: "imported" as const,
    isShareable: true,
    isAgeRestricted: e.isAgeRestricted,
    contentWarning: e.contentWarning,
    sourceUid: e.uid,
    sourceUrl: e.sourceUrl,
    isInSchedule: false,
    reminderMinutes: null,
  }));
}
