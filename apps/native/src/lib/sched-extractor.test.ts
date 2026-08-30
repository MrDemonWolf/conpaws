import { afterEach, describe, expect, it, vi } from "vitest";
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
    // The whole point -- the request was stopped, not merely ignored.
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
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
