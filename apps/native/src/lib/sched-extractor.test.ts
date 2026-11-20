import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo/fetch", () => ({
  fetch: (...args: Parameters<typeof globalThis.fetch>) =>
    globalThis.fetch(...args),
}));

import { parseIcs } from "./ical-parser";
import {
  fetchScheduleIcs,
  InvalidResponseError,
  InvalidScheduleUrlError,
  MAX_ICS_BYTES,
  NetworkError,
  ScheduleFetchCancelledError,
  ScheduleTooLargeError,
} from "./sched-extractor";

const CALENDAR = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:1@example.com",
  "DTSTART:20260704T140000Z",
  "SUMMARY:Fursuit Parade",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function respondWith(
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status: 200, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchScheduleIcs", () => {
  it("returns a calendar that fits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respondWith(CALENDAR)));

    const result = await fetchScheduleIcs("https://example.com/all.ics");

    expect(result.icsContent).toContain("Fursuit Parade");
  });

  it("fetches a webcal feed over https and persists the https form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respondWith(CALENDAR));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchScheduleIcs(
      "webcal://examplecon.org/?post_type=tribe_events&ical=1&eventDisplay=list",
    );

    // `webcal:` is not a transport — nothing may ever reach fetch with it.
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://examplecon.org/?post_type=tribe_events&ical=1&eventDisplay=list",
    );
    expect(result.canonicalUrl).toBe(
      "https://examplecon.org/?post_type=tribe_events&ical=1&eventDisplay=list",
    );
    expect(result.icsContent).toContain("Fursuit Parade");
  });

  it("refuses before reading when Content-Length is over the cap", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respondWith(CALENDAR, {
        "content-length": String(MAX_ICS_BYTES + 1),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchScheduleIcs("https://example.com/all.ics"),
    ).rejects.toBeInstanceOf(ScheduleTooLargeError);
  });

  // A chunked response carries no Content-Length, and a hostile one is free to
  // understate it. The decoded body length is the backstop.
  it("refuses an oversized body that declared nothing", async () => {
    const huge = `${CALENDAR}\r\nX-PAD:${"z".repeat(MAX_ICS_BYTES)}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respondWith(huge)));

    await expect(
      fetchScheduleIcs("https://example.com/all.ics"),
    ).rejects.toBeInstanceOf(ScheduleTooLargeError);
  });

  it("still rejects a non-calendar body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respondWith("<!doctype html><html></html>")),
    );

    await expect(
      fetchScheduleIcs("https://example.com/all.ics"),
    ).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it("still rejects a scheme that must never be fetched", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchScheduleIcs("file:///etc/passwd")).rejects.toBeInstanceOf(
      InvalidScheduleUrlError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a non-2xx as a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 404 })),
    );

    await expect(
      fetchScheduleIcs("https://example.com/all.ics"),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it("calls a timeout a timeout, not a cancellation", async () => {
    // No caller signal, so the only thing that can have aborted is the 30s
    // timer -- and the reader is owed the difference.
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("Aborted"), { name: "AbortError" }),
        ),
    );

    await expect(
      fetchScheduleIcs("https://example.com/all.ics"),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it("aborts the request when the caller gives up", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchScheduleIcs("https://example.com/all.ics", {
      signal: controller.signal,
    });
    controller.abort();

    // A cancellation is its own type: the import screen shows nothing for it,
    // where a NetworkError would raise "couldn't reach the schedule".
    await expect(pending).rejects.toBeInstanceOf(ScheduleFetchCancelledError);
    // Dynamic module loading may let cancellation win before transport starts.
    // If transport did start, it must receive the aborted signal.
    if (fetchMock.mock.calls.length > 0) {
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    }
  });

  it("does not start a request the caller has already abandoned", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchScheduleIcs("https://example.com/all.ics", {
        signal: AbortSignal.abort(),
      }),
    ).rejects.toBeInstanceOf(ScheduleFetchCancelledError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchScheduleIcs on an Events Calendar site", () => {
  // The Events Calendar export: 30 events, UIDs `<post id>-<start>-<end>@host`.
  const tribeFeed = readFileSync(
    path.resolve(__dirname, "../../../../test-data/tribe-events-con.ics"),
    "utf8",
  );
  const FEED_URL =
    "https://tribeeventscon.example.org/?post_type=tribe_events&ical=1&eventDisplay=list";
  const postIds = Array.from(
    tribeFeed.matchAll(/^UID:(\d+)-/gm),
    (match) => match[1],
  );

  function restEvents(ids: string[]) {
    return ids.map((id) => ({
      id: Number(id),
      title: `Panel ${id}`,
      utc_start_date: "2026-09-04 15:00:00",
      utc_end_date: "2026-09-04 16:00:00",
      timezone: "America/Indiana/Indianapolis",
    }));
  }

  function stubSite(rest: () => Response) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/wp-json/tribe/events/v1/events")
          ? rest()
          : respondWith(tribeFeed),
      ),
    );
  }

  async function importedUids(): Promise<string[]> {
    const fetched = await fetchScheduleIcs(FEED_URL);
    return parseIcs(fetched.icsContent).events.map((event) => event.sourceUid);
  }

  it("keeps the REST identity when the expansion fails", async () => {
    // What a healthy expansion stores: every feed event plus the ones the
    // list view cut off.
    stubSite(() =>
      Response.json({
        events: restEvents([...postIds, "99001"]),
        total_pages: 1,
      }),
    );
    const expandedUids = await importedUids();
    vi.unstubAllGlobals();

    // A re-import while the REST route has a bad minute falls back to the
    // truncated feed. Its events must still be the ones already stored, or the
    // import marks every saved panel removed and adds an unsaved copy.
    stubSite(() => new Response("busy", { status: 503 }));
    const fallbackUids = await importedUids();

    expect(fallbackUids).toHaveLength(30);
    expect(fallbackUids).toContain("8154@conpaws.ecp");
    for (const uid of fallbackUids) {
      expect(uid).toMatch(/^\d+@conpaws\.ecp$/);
      expect(expandedUids).toContain(uid);
    }
  });

  it("keeps the REST identity when the feed wins the event count", async () => {
    // A convention with no more events than the list view shows imports the
    // feed itself. Once its schedule outgrows the cap the REST body wins, and
    // that must not swap every identity either.
    stubSite(() =>
      Response.json({ events: restEvents(postIds), total_pages: 1 }),
    );

    const uids = await importedUids();

    expect(uids).toHaveLength(30);
    expect(uids).toContain("8154@conpaws.ecp");
    for (const uid of uids) expect(uid).toMatch(/^\d+@conpaws\.ecp$/);
  });
});
