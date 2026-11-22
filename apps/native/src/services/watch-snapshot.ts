import type { ConventionEvent } from "@/db/schema";
import { hasVisit } from "@/lib/drop-in-visit";
import { decodeHtmlEntities } from "@/lib/ical-text";
import {
  HOUR_MS,
  hourSlotStartMs,
  isDropInEvent,
  matchesHourSlot,
} from "@/lib/schedule-browse";
import type {
  WidgetConventionSnapshot,
  WidgetEventSnapshot,
  WidgetSnapshot,
} from "./widget-snapshot";

/**
 * What the Watch gets on top of the widget snapshot: a short plain-text
 * description for each event, the unsaved events it may offer to add, and
 * the ids of the Watch commands the phone has finished with.
 *
 * iOS only. Android stores the same payload for its boundary timer, which has
 * no use for either, and the phone widgets are published from the original
 * snapshot object, which this never touches. Everything added is optional on
 * the Swift side, so the schema version stays 2 and older payloads decode.
 */

/** Characters, not bytes: the cut is about what fits on a wrist. */
export const WATCH_SUMMARY_MAX_LENGTH = 280;
export const WATCH_OPTIONS_LIMIT = 24;
/** How far ahead options are sent. The Watch shows the current hour of it. */
export const WATCH_OPTIONS_WINDOW_MS = 6 * HOUR_MS;
/** Mirrors the `limit` of `optionsThisHour(at:)`: what the Watch lists per hour. */
export const WATCH_OPTIONS_PER_HOUR = 5;
/**
 * WatchConnectivity refuses application contexts and messages past roughly
 * 64 KB, and a refused update leaves the Watch on its old schedule. 48 KB
 * keeps clear of that with a large schedule's saved events already in it.
 *
 * Measured in UTF-8 because that is what crosses: the native module sends the
 * JSON as UTF-8 `Data`. Sent as a `String` instead, one non-ASCII character
 * (the summary's own ellipsis will do) turns the whole property-list string
 * into UTF-16 and doubles it, and this guard would measure half of it.
 */
export const WATCH_PAYLOAD_MAX_BYTES = 48 * 1024;

/** Mirrors `ConPawsScheduleResolver.longestCountedPanelMs`. */
export const WATCH_LONGEST_COUNTED_PANEL_MS = 24 * HOUR_MS;

export type WatchEventSnapshot = WidgetEventSnapshot & { summary?: string };

export type WatchConventionSnapshot = Omit<
  WidgetConventionSnapshot,
  "events"
> & {
  events: WatchEventSnapshot[];
  options?: WatchEventSnapshot[];
};

/** Tags that separate words; every other tag is removed without a space. */
const BLOCK_TAG =
  /<\/?(?:br|p|div|li|ul|ol|h[1-6]|tr|td|th|table|blockquote|section|article|header|footer|hr)\b[^>]*>/gi;
/** Only something that starts like a tag, so "5 < 6 and 7 > 3" survives. */
const ANY_TAG = /<\/?[a-z!][^>]*>/gi;
/** Named entities ICS and ECP descriptions use that the shared decoder does not. */
const EXTRA_ENTITIES: Record<string, string> = {
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

/**
 * An event description as one line of plain text, at most 280 characters,
 * cut on a word boundary with an ellipsis. Undefined when nothing is left.
 */
export function plainTextSummary(
  description: string | null | undefined,
): string | undefined {
  if (!description) return undefined;
  const stripped = description
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(BLOCK_TAG, " ")
    .replace(ANY_TAG, "")
    // Before the shared decoder, which decodes &amp; first: "&amp;mdash;"
    // must stay the literal text "&mdash;", not become a dash.
    .replace(
      /&(hellip|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/gi,
      (_match, name: string) => EXTRA_ENTITIES[name.toLowerCase()] ?? "",
    );
  const text = decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
  if (!text) return undefined;

  const characters = Array.from(text);
  if (characters.length <= WATCH_SUMMARY_MAX_LENGTH) return text;

  // One short of the limit, leaving room for the ellipsis.
  const limit = WATCH_SUMMARY_MAX_LENGTH - 1;
  let head = characters.slice(0, limit).join("");
  if (!/\s/.test(characters[limit] ?? "")) {
    const lastSpace = head.search(/\s\S*$/);
    // A boundary in the first half would throw most of the text away for the
    // sake of one long token (a URL); a hard cut is the better answer there.
    if (lastSpace >= head.length / 2) head = head.slice(0, lastSpace);
  }
  return `${head.replace(/[\s,;:.!?–—-]+$/u, "")}…`;
}

/**
 * The unsaved events the Watch may offer to add, mirroring the phone's
 * "Other options this hour" rule over a longer window so the Watch can show
 * whichever hour it is when it looks: not saved, still published, a timed
 * panel rather than a drop-in room, no visit, and overlapping the next six
 * hours. Soonest first, then by title.
 *
 * When more qualify than are sent, the places are shared out over the
 * convention-local hours of the window: each hour in turn gets one, up to the
 * five the Watch lists for an hour, and only then does the rest go to
 * whatever starts soonest. Otherwise a convention running a dozen rooms
 * spends every place on its first hour or two, and nothing republishes the
 * snapshot when the hour turns.
 */
export function selectWatchOptions(
  events: readonly ConventionEvent[],
  nowMs: number,
  timeZone = "UTC",
): ConventionEvent[] {
  const windowEndMs = nowMs + WATCH_OPTIONS_WINDOW_MS;
  const candidates = events
    .flatMap((event) => {
      if (
        event.isInSchedule ||
        event.feedStatus !== null ||
        hasVisit(event) ||
        isDropInEvent(event)
      )
        return [];
      const startMs = Date.parse(event.startTime);
      if (!Number.isFinite(startMs) || startMs >= windowEndMs) return [];
      const parsedEnd = event.endTime ? Date.parse(event.endTime) : Number.NaN;
      const endMs = Number.isFinite(parsedEnd) ? parsedEnd : startMs + HOUR_MS;
      return endMs > nowMs ? [{ event, startMs }] : [];
    })
    .sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.event.title.localeCompare(right.event.title),
    )
    .map(({ event }) => event);
  if (candidates.length <= WATCH_OPTIONS_LIMIT) return candidates;

  const chosen = new Set<ConventionEvent>();
  const slots = windowHourSlots(nowMs, windowEndMs, timeZone).map(
    (slotStartMs) => ({
      events: candidates.filter((event) => matchesHourSlot(event, slotStartMs)),
      next: 0,
    }),
  );
  for (let turn = 0; turn < WATCH_OPTIONS_PER_HOUR; turn += 1) {
    for (const slot of slots) {
      if (chosen.size >= WATCH_OPTIONS_LIMIT) break;
      // An event running across two hours counts once, for the first.
      while (
        slot.next < slot.events.length &&
        chosen.has(slot.events[slot.next] as ConventionEvent)
      )
        slot.next += 1;
      const event = slot.events[slot.next];
      if (!event) continue;
      chosen.add(event);
      slot.next += 1;
    }
  }
  for (const event of candidates) {
    if (chosen.size >= WATCH_OPTIONS_LIMIT) break;
    chosen.add(event);
  }
  return candidates.filter((event) => chosen.has(event));
}

/**
 * The starts of the convention-local hours from the one holding `fromMs` up
 * to `toMs`. An unknown zone falls back to UTC hours, which only moves where
 * the shares are cut.
 */
function windowHourSlots(
  fromMs: number,
  toMs: number,
  timeZone: string,
): number[] {
  const slotStart = (ms: number) => {
    try {
      return hourSlotStartMs(ms, timeZone);
    } catch {
      return Math.floor(ms / HOUR_MS) * HOUR_MS;
    }
  };
  const slots: number[] = [];
  for (let slot = slotStart(fromMs); slot < toMs; ) {
    slots.push(slot);
    const next = slotStart(slot + HOUR_MS);
    // Guards a zone whose formatter answers the same hour twice.
    slot = next > slot ? next : slot + HOUR_MS;
  }
  return slots;
}

/** UTF-8 bytes: the native module sends the payload as UTF-8 `Data`. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function withSummary(
  event: WidgetEventSnapshot,
  description: string | null | undefined,
): WatchEventSnapshot {
  const summary = plainTextSummary(description);
  return summary === undefined ? event : { ...event, summary };
}

function withoutSummary(event: WatchEventSnapshot): WatchEventSnapshot {
  if (event.summary === undefined) return event;
  const { summary: _summary, ...rest } = event;
  return rest;
}

function hasEnded(event: WatchEventSnapshot, nowMs: number): boolean {
  return (event.endAtMs ?? event.startAtMs + HOUR_MS) <= nowMs;
}

/**
 * The last moment the Watch counts a convention as active or upcoming,
 * inclusive: its end, or a saved panel's end when one runs later, counted for
 * a day from the panel's start at most. Mirrors
 * `ConPawsScheduleResolver.lastActiveMs`; watch-resolver-contract.test.ts
 * holds the two together.
 */
export function watchLastActiveMs(
  convention: Pick<WidgetConventionSnapshot, "endAtMs" | "events">,
): number {
  return convention.events.reduce(
    (latest, event) =>
      Math.max(
        latest,
        Math.min(
          event.endAtMs ?? event.startAtMs + HOUR_MS,
          event.startAtMs + WATCH_LONGEST_COUNTED_PANEL_MS,
        ),
      ),
    convention.endAtMs,
  );
}

/**
 * The conventions the Watch can still show from `nowMs` on. Choosing for
 * itself, it picks among those still active or upcoming, and only when there
 * are none falls back to the one that ends last, so any other convention that
 * is over can never be shown again. The one that ends last always stays, so
 * this is never empty when `conventions` is not: the Watch reads an empty list
 * as "no schedule".
 */
function watchReachableConventions(
  conventions: readonly WidgetConventionSnapshot[],
  nowMs: number,
): WidgetConventionSnapshot[] {
  const latestEndAtMs = conventions.reduce(
    (latest, convention) => Math.max(latest, convention.endAtMs),
    Number.NEGATIVE_INFINITY,
  );
  return conventions.filter(
    (convention) =>
      convention.endAtMs === latestEndAtMs ||
      watchLastActiveMs(convention) >= nowMs,
  );
}

export interface WatchExtrasOptions {
  /** `process.env.EXPO_OS`; anything but "ios" gets today's payload. */
  os: string | undefined;
  nowMs: number;
  /** Converts an unsaved row the way saved rows are converted for the widget. */
  toOption: (event: ConventionEvent) => WidgetEventSnapshot | null;
  /**
   * Watch commands the phone has finished with, whatever the outcome. The
   * Watch stops showing a tap as waiting once its id is listed, so a tap the
   * phone declined frees its button instead of spinning for a day. Kept at
   * every step of the size guard: it is small and nothing else replaces it.
   */
  handledCommandIds?: readonly string[];
  maxBytes?: number;
}

/**
 * The JSON handed to the native module's `publishSnapshot`: the snapshot
 * without its phone presentation, plus the Watch extras on iOS.
 *
 * On iOS, conventions the Watch can no longer show are left out whatever the
 * size: every one that is over except the one that ended last. A user who
 * never archives would otherwise send each past convention's saved panels,
 * which crowd out the active one's descriptions and options, and in time pass
 * what WatchConnectivity accepts at all.
 *
 * When that is still too large it gives things up in order of how little
 * they are missed: option descriptions, then descriptions of saved panels
 * that have ended, then the latest-starting options, then every description.
 * At worst the result is the payload the Watch received before any of this
 * existed, less the conventions it can no longer show, plus the ids of the
 * commands the phone has handled.
 */
export function withWatchExtras(
  snapshot: WidgetSnapshot,
  eventsByConvention: ReadonlyMap<string, readonly ConventionEvent[]>,
  {
    os,
    nowMs,
    toOption,
    handledCommandIds = [],
    maxBytes = WATCH_PAYLOAD_MAX_BYTES,
  }: WatchExtrasOptions,
): string {
  const base = { ...snapshot, presentation: undefined };
  if (os !== "ios") return JSON.stringify(base);
  const handled =
    handledCommandIds.length > 0
      ? { handledCommandIds: [...handledCommandIds] }
      : {};

  let conventions: WatchConventionSnapshot[] = watchReachableConventions(
    snapshot.conventions,
    nowMs,
  ).map((convention) => {
    // A convention that is over offers nothing, and the Watch shows only a
    // finished state for it, so its descriptions would be dead weight.
    if (convention.endAtMs <= nowMs) return convention;
    const source = eventsByConvention.get(convention.id) ?? [];
    const descriptions = new Map(
      source.map((event) => [event.id, event.description]),
    );
    const events = convention.events.map((event) =>
      withSummary(event, descriptions.get(event.id)),
    );
    const options = selectWatchOptions(
      source,
      nowMs,
      convention.timeZoneIdentifier,
    ).flatMap((event) => {
      const option = toOption(event);
      return option ? [withSummary(option, event.description)] : [];
    });
    return options.length > 0
      ? { ...convention, events, options }
      : { ...convention, events };
  });

  const serialize = () => JSON.stringify({ ...base, ...handled, conventions });
  let json = serialize();
  const overBy = () => utf8ByteLength(json) - maxBytes;
  if (overBy() <= 0) return json;

  conventions = conventions.map((convention) =>
    convention.options
      ? { ...convention, options: convention.options.map(withoutSummary) }
      : convention,
  );
  json = serialize();
  if (overBy() <= 0) return json;

  conventions = conventions.map((convention) => ({
    ...convention,
    events: convention.events.map((event) =>
      hasEnded(event, nowMs) ? withoutSummary(event) : event,
    ),
  }));
  json = serialize();

  // Latest start first across every convention: the Watch shows the current
  // hour, so the far end of the window is what it misses least. Each pass
  // drops roughly the excess before measuring again, rather than
  // re-serializing the whole snapshot once per option.
  conventions = conventions.map((convention) =>
    convention.options
      ? { ...convention, options: [...convention.options] }
      : convention,
  );
  let excess = overBy();
  while (excess > 0) {
    let pick: WatchConventionSnapshot | undefined;
    for (const convention of conventions) {
      const last = convention.options?.[convention.options.length - 1];
      const picked = pick?.options?.[pick.options.length - 1];
      if (last && (!picked || last.startAtMs >= picked.startAtMs))
        pick = convention;
    }
    const removed = pick?.options?.pop();
    if (!pick || !removed) break;
    if (pick.options?.length === 0) delete pick.options;
    excess -= utf8ByteLength(JSON.stringify(removed)) + 1;
    if (excess <= 0) {
      json = serialize();
      excess = overBy();
    }
  }
  json = serialize();
  if (overBy() <= 0) return json;

  conventions = conventions.map((convention) => ({
    ...convention,
    events: convention.events.map(withoutSummary),
  }));
  return serialize();
}
