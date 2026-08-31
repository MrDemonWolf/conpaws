import { describe, expect, it } from "vitest";
import {
  InvalidScheduleUrlError,
  looksLikeCalendar,
  resolveScheduleUrl,
  reversedSchedSuggestion,
  scheduleNameFromUrl,
} from "./schedule-url";

describe("resolveScheduleUrl", () => {
  it("rewrites a webcal link to https and keeps the query string", () => {
    const resolved = resolveScheduleUrl(
      "webcal://examplecon.org/?post_type=tribe_events&ical=1&eventDisplay=list",
    );

    expect(resolved.kind).toBe("ics");
    expect(resolved.fetchUrl).toBe(
      "https://examplecon.org/?post_type=tribe_events&ical=1&eventDisplay=list",
    );
    // The canonical form is what gets persisted as the convention's feed URL
    // and re-fetched on every later refresh, so a `webcal:` leaking through
    // here would break re-import rather than just this one fetch.
    expect(resolved.canonicalUrl).toBe(
      "https://examplecon.org/?post_type=tribe_events&ical=1&eventDisplay=list",
    );
  });

  it("keeps a webcal feed's own path and port", () => {
    const resolved = resolveScheduleUrl(
      "webcal://schedule.examplecon.org:8443/exports/all.ics?key=abc",
    );

    expect(resolved.fetchUrl).toBe(
      "https://schedule.examplecon.org:8443/exports/all.ics?key=abc",
    );
    expect(resolved.canonicalUrl).toBe(resolved.fetchUrl);
  });

  it("treats a webcal Sched address as Sched", () => {
    const resolved = resolveScheduleUrl("webcal://examplecon2025.sched.com/");

    expect(resolved.kind).toBe("sched");
    expect(resolved.fetchUrl).toBe("https://examplecon2025.sched.com/all.ics");
  });

  it("accepts WEBCAL in any case", () => {
    expect(resolveScheduleUrl("WEBCAL://example.org/feed.ics").fetchUrl).toBe(
      "https://example.org/feed.ics",
    );
  });

  it("turns any page on a Sched site into the full schedule feed", () => {
    for (const input of [
      "https://examplecon2025.sched.com",
      "https://examplecon2025.sched.com/",
      "https://examplecon2025.sched.com/event/abc123",
      "  https://ExampleCon2025.sched.com/directory/speakers  ",
    ]) {
      const resolved = resolveScheduleUrl(input);
      expect(resolved.kind).toBe("sched");
      expect(resolved.fetchUrl).toBe(
        "https://examplecon2025.sched.com/all.ics",
      );
      expect(resolved.canonicalUrl).toBe("https://examplecon2025.sched.com");
    }
  });

  it("passes a direct .ics link through untouched", () => {
    const resolved = resolveScheduleUrl("https://example.org/all.ics");
    expect(resolved).toEqual({
      fetchUrl: "https://example.org/all.ics",
      kind: "ics",
      canonicalUrl: "https://example.org/all.ics",
    });
  });

  it("upgrades http to https rather than fetching in the clear", () => {
    expect(resolveScheduleUrl("http://example.org/all.ics").fetchUrl).toBe(
      "https://example.org/all.ics",
    );
    expect(resolveScheduleUrl("http://acon.sched.com").kind).toBe("sched");
  });

  it("rejects schemes that must never be fetched or persisted", () => {
    for (const input of [
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/calendar,BEGIN:VCALENDAR",
      "ftp://example.org/all.ics",
    ]) {
      expect(() => resolveScheduleUrl(input)).toThrow(InvalidScheduleUrlError);
    }
  });

  it("rejects empty input and bare hostnames rather than guessing", () => {
    expect(() => resolveScheduleUrl("")).toThrow(InvalidScheduleUrlError);
    expect(() => resolveScheduleUrl("   ")).toThrow(InvalidScheduleUrlError);
    expect(() => resolveScheduleUrl("examplecon.org")).toThrow(
      InvalidScheduleUrlError,
    );
  });

  it("does not treat a lookalike host as Sched", () => {
    expect(resolveScheduleUrl("https://sched.com.evil.test/x").kind).toBe(
      "ics",
    );
    expect(resolveScheduleUrl("https://notsched.example/all.ics").kind).toBe(
      "ics",
    );
  });
});

describe("a Sched address written backwards", () => {
  it("suggests the right host", () => {
    // The real report: sched.furality.com. It does not resolve, so the fetch
    // died on DNS and the app said "check your connection" -- advice that is
    // wrong, and that sent a real person chasing wifi for days.
    expect(reversedSchedSuggestion("https://sched.furality.com/all.ics")).toBe(
      "furality.sched.com",
    );
  });

  it("lower-cases the suggestion", () => {
    expect(reversedSchedSuggestion("https://SCHED.Furality.COM")).toBe(
      "furality.sched.com",
    );
  });

  it("does NOT block the import", () => {
    // The safety property. `sched.example.org` is an ordinary subdomain any
    // convention might use for a schedule it hosts itself -- nothing to do
    // with Sched the company. Rejecting it would turn a working import into a
    // hard failure, so resolveScheduleUrl still resolves it normally and the
    // suggestion is only consulted after a fetch has actually failed.
    const resolved = resolveScheduleUrl("https://sched.example.org/all.ics");
    expect(resolved.kind).toBe("ics");
    expect(resolved.fetchUrl).toBe("https://sched.example.org/all.ics");
  });

  it("stays quiet on hosts that are not that shape", () => {
    // Four labels, and `sched` not first: neither is the typo.
    expect(reversedSchedSuggestion("https://sched.example.co.uk")).toBeNull();
    expect(reversedSchedSuggestion("https://my.sched.example.com")).toBeNull();
    expect(reversedSchedSuggestion("https://furality.sched.com")).toBeNull();
    expect(reversedSchedSuggestion("not a url")).toBeNull();
  });

  it("leaves a real Sched address alone", () => {
    expect(resolveScheduleUrl("https://furality.sched.com").fetchUrl).toBe(
      "https://furality.sched.com/all.ics",
    );
  });
});

describe("looksLikeCalendar", () => {
  it("accepts a real calendar body regardless of leading whitespace or case", () => {
    expect(looksLikeCalendar("BEGIN:VCALENDAR\r\nVERSION:2.0")).toBe(true);
    expect(looksLikeCalendar("\n  begin:vcalendar\n")).toBe(true);
  });

  it("rejects an HTML error page served with a 200", () => {
    expect(looksLikeCalendar("<!doctype html><html>Not found</html>")).toBe(
      false,
    );
    expect(looksLikeCalendar("")).toBe(false);
  });
});

describe("scheduleNameFromUrl", () => {
  it("uses the Sched subdomain as the convention name", () => {
    expect(
      scheduleNameFromUrl("https://examplecon2025.sched.com/all.ics"),
    ).toBe("examplecon2025");
  });

  it("falls back to the bare host for other feeds", () => {
    expect(scheduleNameFromUrl("https://www.examplecon.org/?ical=1")).toBe(
      "examplecon.org",
    );
  });

  it("returns empty rather than throwing on junk", () => {
    expect(scheduleNameFromUrl("not a url")).toBe("");
  });
});
