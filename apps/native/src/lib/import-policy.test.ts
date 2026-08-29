import { describe, expect, it } from "vitest";
import {
  canApplyScheduleImport,
  parseIcsPreferringFeedTimeZone,
} from "./import-policy";

const emptyImport = {
  conventionId: "convention-1",
  sourceUrl: null,
  selectedEventCount: 0,
  sourceEventCount: 0,
  cancelledEventCount: 0,
};

describe("schedule import policy", () => {
  it("allows an empty authoritative feed for an existing convention", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        sourceUrl: "https://example.sched.com",
      }),
    ).toBe(true);
  });

  it("rejects an empty feed for a new convention", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        conventionId: "new",
        sourceUrl: "https://example.sched.com",
      }),
    ).toBe(false);
  });

  it("rejects an empty local file", () => {
    expect(canApplyScheduleImport(emptyImport)).toBe(false);
  });

  it("allows an existing local cancellation tombstone", () => {
    expect(
      canApplyScheduleImport({ ...emptyImport, cancelledEventCount: 1 }),
    ).toBe(true);
  });

  it("rejects deselecting every event in a nonempty feed", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        sourceUrl: "https://example.sched.com",
        sourceEventCount: 4,
      }),
    ).toBe(false);
  });

  it("allows any source with a selected active event", () => {
    expect(
      canApplyScheduleImport({
        ...emptyImport,
        conventionId: "new",
        selectedEventCount: 1,
        sourceEventCount: 1,
      }),
    ).toBe(true);
  });
});

describe("parseIcsPreferringFeedTimeZone", () => {
  function calendar(lines: string[]): string {
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      ...lines,
      "BEGIN:VEVENT",
      "UID:tz-001",
      "SUMMARY:Zone Probe",
      "DTSTART;TZID=__TZID__:20260903T170000",
      "DTEND;TZID=__TZID__:20260903T180000",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .join("\r\n")
      .replace(/;TZID=__TZID__/g, "");
  }

  it("keeps the feed's own zone even when a fallback is supplied", () => {
    const result = parseIcsPreferringFeedTimeZone(
      calendar(["X-WR-TIMEZONE:America/Indiana/Indianapolis"]),
      "America/Chicago",
    );

    expect(result.timezone).toBe("America/Indiana/Indianapolis");
    // Floating local time resolved through the feed's zone: 17:00 EDT = 21:00Z.
    // Had the fallback won it would be 22:00Z, an hour late on every event.
    expect(result.events[0].startTime.toISOString()).toBe(
      "2026-09-03T21:00:00.000Z",
    );
  });

  it("uses the fallback only when the calendar declares no zone", () => {
    const result = parseIcsPreferringFeedTimeZone(
      calendar([]),
      "America/Chicago",
    );

    expect(result.timezone).toBe("America/Chicago");
    expect(result.requiresTimeZone).toBe(false);
    expect(result.events[0].startTime.toISOString()).toBe(
      "2026-09-03T22:00:00.000Z",
    );
  });

  it("reports that a zone is still needed when there is no fallback", () => {
    const result = parseIcsPreferringFeedTimeZone(calendar([]));

    expect(result.timezone).toBeNull();
    expect(result.requiresTimeZone).toBe(true);
    expect(result.events).toEqual([]);
  });
});
