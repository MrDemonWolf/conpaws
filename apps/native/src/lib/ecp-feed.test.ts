import { describe, expect, it, vi } from "vitest";
import {
  buildIcsFromEcpEvents,
  type EcpEvent,
  ecpRestEndpoint,
  fetchEcpFullSchedule,
  isEventsCalendarFeed,
} from "./ecp-feed";
import { parseIcs } from "./ical-parser";

const event = (over: Partial<EcpEvent> = {}): EcpEvent => ({
  id: 1,
  title: "Opening Ceremonies",
  utc_start_date: "2026-09-03 23:00:00",
  utc_end_date: "2026-09-04 00:00:00",
  timezone: "America/Indiana/Indianapolis",
  venue: { venue: "Main Stage" },
  ...over,
});

describe("isEventsCalendarFeed", () => {
  it("recognises an Events Calendar export by its PRODID", () => {
    expect(
      isEventsCalendarFeed(
        "BEGIN:VCALENDAR\r\nPRODID:-//Example - ECPv6.17.3.1//NONSGML v1.0//EN\r\n",
      ),
    ).toBe(true);
  });

  it("leaves other exports alone", () => {
    expect(
      isEventsCalendarFeed("BEGIN:VCALENDAR\r\nPRODID:-//sched.com//EN\r\n"),
    ).toBe(false);
  });
});

describe("ecpRestEndpoint", () => {
  it("keeps the origin of the feed being fetched", () => {
    expect(
      ecpRestEndpoint("https://example.org/?post_type=tribe_events&ical=1"),
    ).toBe("https://example.org/wp-json/tribe/events/v1/events");
  });

  it("refuses anything that is not https", () => {
    expect(ecpRestEndpoint("http://example.org/?ical=1")).toBeNull();
    expect(ecpRestEndpoint("not a url")).toBeNull();
  });
});

describe("buildIcsFromEcpEvents", () => {
  it("round-trips through the real parser", () => {
    const ics = buildIcsFromEcpEvents([event()]);
    const result = parseIcs(ics);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].title).toBe("Opening Ceremonies");
    expect(result.events[0].location).toBe("Main Stage");
  });

  it("declares the convention timezone once", () => {
    expect(buildIcsFromEcpEvents([event()])).toContain(
      "X-WR-TIMEZONE:America/Indiana/Indianapolis",
    );
  });

  it("decodes the HTML entities the REST API returns in titles", () => {
    const ics = buildIcsFromEcpEvents([
      event({ title: "Tabletop &#8211; Boss Monster &amp; Friends" }),
    ]);
    expect(parseIcs(ics).events[0].title).toBe(
      "Tabletop – Boss Monster & Friends",
    );
  });

  it("strips markup out of descriptions", () => {
    const ics = buildIcsFromEcpEvents([
      event({ description: "<p>Dust off your <b>dancing paws</b></p>" }),
    ]);
    expect(parseIcs(ics).events[0].description).toBe(
      "Dust off your dancing paws",
    );
  });

  it("escapes the characters that would otherwise break a property line", () => {
    const ics = buildIcsFromEcpEvents([
      event({ title: "Panels; talks, more" }),
    ]);
    expect(ics).toContain("SUMMARY:Panels; talks\\, more");
    expect(parseIcs(ics).events[0].title).toBe("Panels; talks, more");
  });

  it("folds long lines to 75 octets", () => {
    const ics = buildIcsFromEcpEvents([
      event({ title: "Ünïcödé ".repeat(20) }),
    ]);
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("skips events with no usable start rather than emitting invalid ones", () => {
    const ics = buildIcsFromEcpEvents([
      event({ id: 1 }),
      event({ id: 2, utc_start_date: undefined }),
    ]);
    expect(parseIcs(ics).events).toHaveLength(1);
  });
});

describe("fetchEcpFullSchedule", () => {
  const page = (events: EcpEvent[], total_pages: number) => ({
    ok: true,
    json: async () => ({ events, total_pages }),
  });

  it("follows pagination and asks for the whole date range", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page([event({ id: 1 })], 2))
      .mockResolvedValueOnce(page([event({ id: 2 })], 2));
    vi.stubGlobal("fetch", fetchMock);

    const ics = await fetchEcpFullSchedule("https://example.org/?ical=1");
    expect(parseIcs(ics ?? "").events).toHaveLength(2);

    // Without an explicit floor the API answers "upcoming from now", which
    // would drop every finished panel when re-imported during a convention.
    expect(fetchMock.mock.calls[0][0]).toContain("start_date=2000-01-01");
    vi.unstubAllGlobals();
  });

  it("gives up quietly when the REST route is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(
      await fetchEcpFullSchedule("https://example.org/?ical=1"),
    ).toBeNull();
    vi.unstubAllGlobals();
  });

  it("gives up quietly when the response is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );
    expect(
      await fetchEcpFullSchedule("https://example.org/?ical=1"),
    ).toBeNull();
    vi.unstubAllGlobals();
  });

  it("stops at the page cap even when the server keeps claiming more", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page([event()], 9999));
    vi.stubGlobal("fetch", fetchMock);

    await fetchEcpFullSchedule("https://example.org/?ical=1");
    expect(fetchMock).toHaveBeenCalledTimes(20);
    vi.unstubAllGlobals();
  });
});
