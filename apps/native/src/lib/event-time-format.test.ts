import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import en from "../locales/en.json";
import {
  eventEndDayOffset,
  formatConventionDate,
  formatDayKeyLabel,
  formatEventDayLabel,
  formatEventDuration,
  formatEventEndDateTime,
  formatEventEndTime,
  formatEventTime,
  formatMinutesLeft,
  formatMinutesUntilStart,
  formatNowHeroTimes,
  scheduleFormatter,
} from "./event-time-format";

describe("scheduleFormatter", () => {
  it("returns the same instance for the same key", () => {
    const first = scheduleFormatter("time", "en", "UTC");
    const second = scheduleFormatter("time", "en", "UTC");

    expect(second).toBe(first);
  });

  it("keys separately on kind, locale, zone and clock", () => {
    const base = scheduleFormatter("time", "en", "UTC");

    expect(scheduleFormatter("dayLabel", "en", "UTC")).not.toBe(base);
    expect(scheduleFormatter("time", "de", "UTC")).not.toBe(base);
    expect(scheduleFormatter("time", "en", "America/Chicago")).not.toBe(base);
    expect(scheduleFormatter("time", "en", "UTC", false)).not.toBe(base);
  });
});

describe("formatEventTime", () => {
  it("returns an empty string for a missing time", () => {
    expect(formatEventTime(null, "UTC", "en")).toBe("");
  });

  it("returns an empty string for an unparseable time", () => {
    expect(formatEventTime("not a date", "UTC", "en")).toBe("");
  });

  it("renders in the convention zone across a spring-forward boundary", () => {
    // 2026-03-08 is the US spring-forward date: 07:30Z is still CST, 08:30Z is
    // already CDT, so the same 60 minutes apart render two hours apart.
    const before = formatEventTime(
      "2026-03-08T07:30:00.000Z",
      "America/Chicago",
      "en",
      false,
    );
    const after = formatEventTime(
      "2026-03-08T08:30:00.000Z",
      "America/Chicago",
      "en",
      false,
    );

    expect(before).toBe("01:30");
    expect(after).toBe("03:30");
  });

  it("honours a 12-hour clock request", () => {
    expect(
      formatEventTime("2026-07-04T20:30:00.000Z", "UTC", "en", true),
    ).toMatch(/8:30/);
  });
});

describe("day labels", () => {
  it("formats an event group in the convention zone", () => {
    // 01:30Z on the 5th is still the 4th in Chicago.
    expect(
      formatEventDayLabel(
        "2026-07-05T01:30:00.000Z",
        "America/Chicago",
        "en-US",
      ),
    ).toContain("July 4");
  });

  it("formats a plain day key without shifting it", () => {
    expect(formatDayKeyLabel("2026-07-04", "en-US")).toContain("July 4");
  });
});

describe("formatConventionDate", () => {
  it("renders the day key it was given", () => {
    expect(formatConventionDate("2026-07-04", "en-US")).toContain("Jul 4");
  });
});

describe("hour cycle", () => {
  const NOON_THIRTY = "2026-07-04T17:30:00.000Z"; // 12:30 in Chicago
  const HALF_PAST_MIDNIGHT = "2026-07-04T05:30:00.000Z"; // 00:30 in Chicago

  // `hour12: true` resolves to whichever 12-hour cycle a locale prefers, and
  // German prefers h11, which counts 0 to 11. Asking for it that way rendered
  // half past midday as "0:30 PM" for a German user on a 12-hour device.
  it("counts midday as 12, not 0, in a locale that prefers h11", () => {
    const midday = formatEventTime(NOON_THIRTY, "America/Chicago", "de", true);
    const midnight = formatEventTime(
      HALF_PAST_MIDNIGHT,
      "America/Chicago",
      "de",
      true,
    );

    expect(midday).toContain("12:30");
    expect(midday).not.toMatch(/\b0:30/);
    expect(midnight).toContain("12:30");
    expect(midnight).not.toMatch(/\b0:30/);
  });

  it("counts midnight as 00 on a 24-hour clock", () => {
    expect(
      formatEventTime(HALF_PAST_MIDNIGHT, "America/Chicago", "de", false),
    ).toMatch(/^00:30/);
    expect(
      formatEventTime(NOON_THIRTY, "America/Chicago", "de", false),
    ).toMatch(/^12:30/);
  });

  it("leaves the locale's own convention alone when the device has no opinion", () => {
    const german = formatEventTime(NOON_THIRTY, "America/Chicago", "de");
    expect(german).not.toMatch(/AM|PM/);
  });
});

/**
 * IndyFurCon 2025's "Tabletop Gaming" — DTSTART 2025-08-14T22:00:00Z,
 * DTEND 2025-08-17T21:00:00Z — used to render "10:00 PM" over "9:00 PM",
 * which reads as ending three hours before it starts.
 */
const CON_ZONE = "America/Indiana/Indianapolis";
const TABLETOP_START = "2025-08-14T22:00:00.000Z";
const TABLETOP_END = "2025-08-17T21:00:00.000Z";

describe("eventEndDayOffset", () => {
  it("is zero for an event that ends the same convention day", () => {
    expect(
      eventEndDayOffset(
        "2025-08-14T18:00:00.000Z",
        "2025-08-14T20:00:00.000Z",
        CON_ZONE,
      ),
    ).toBe(0);
  });

  it("is one for an event that crosses midnight", () => {
    // 8 PM to 1 AM Eastern: four hours, but two calendar days.
    expect(
      eventEndDayOffset(
        "2025-08-15T00:00:00.000Z",
        "2025-08-15T05:00:00.000Z",
        CON_ZONE,
      ),
    ).toBe(1);
  });

  it("counts whole days, not elapsed hours", () => {
    expect(eventEndDayOffset(TABLETOP_START, TABLETOP_END, CON_ZONE)).toBe(3);
  });

  // The convention zone decides the boundary, not the device or UTC: this
  // event is the 15th in Indianapolis but already the 16th in UTC.
  it("uses the convention zone to place the boundary", () => {
    const start = "2025-08-16T01:00:00.000Z";
    const end = "2025-08-16T03:00:00.000Z";

    expect(eventEndDayOffset(start, end, CON_ZONE)).toBe(0);
    expect(eventEndDayOffset(start, end, "UTC")).toBe(0);
    expect(eventEndDayOffset("2025-08-15T23:00:00.000Z", end, "UTC")).toBe(1);
  });

  it("is zero without a usable end", () => {
    expect(eventEndDayOffset(TABLETOP_START, null, CON_ZONE)).toBe(0);
    expect(eventEndDayOffset(TABLETOP_START, "not a date", CON_ZONE)).toBe(0);
    expect(eventEndDayOffset("not a date", TABLETOP_END, CON_ZONE)).toBe(0);
  });
});

describe("formatEventEndTime", () => {
  it("is a bare clock time when the event ends the same day", () => {
    expect(
      formatEventEndTime(
        "2025-08-14T18:00:00.000Z",
        "2025-08-14T20:00:00.000Z",
        CON_ZONE,
        "en",
        true,
      ),
    ).toBe("4:00 PM");
  });

  it("names the weekday when the event ends the next day", () => {
    expect(
      formatEventEndTime(
        "2025-08-15T00:00:00.000Z",
        "2025-08-15T05:00:00.000Z",
        CON_ZONE,
        "en",
        true,
      ),
    ).toBe("Fri 1:00 AM");
  });

  it("names the weekday for a multi-day event", () => {
    expect(
      formatEventEndTime(TABLETOP_START, TABLETOP_END, CON_ZONE, "en", true),
    ).toBe("Sun 5:00 PM");
  });

  it("returns an empty string without an end", () => {
    expect(formatEventEndTime(TABLETOP_START, null, CON_ZONE, "en")).toBe("");
    expect(
      formatEventEndTime(TABLETOP_START, "not a date", CON_ZONE, "en"),
    ).toBe("");
  });

  it("respects the device clock preference", () => {
    expect(
      formatEventEndTime(TABLETOP_START, TABLETOP_END, CON_ZONE, "en", false),
    ).toBe("Sun 17:00");
  });
});

describe("formatEventEndDateTime", () => {
  it("stays a clock time when the sheet already printed that date", () => {
    expect(
      formatEventEndDateTime(
        "2025-08-14T18:00:00.000Z",
        "2025-08-14T20:00:00.000Z",
        CON_ZONE,
        "en",
        true,
      ),
    ).toBe("4:00 PM");
  });

  it("spells out the date when the event ends on another day", () => {
    const label = formatEventEndDateTime(
      TABLETOP_START,
      TABLETOP_END,
      CON_ZONE,
      "en",
      true,
    );

    expect(label).toContain("August 17, 2025");
    expect(label).toContain("5:00 PM");
    expect(label).toContain("Sunday");
  });

  it("returns an empty string without an end", () => {
    expect(formatEventEndDateTime(TABLETOP_START, null, CON_ZONE, "en")).toBe(
      "",
    );
    expect(
      formatEventEndDateTime(TABLETOP_START, "not a date", CON_ZONE, "en"),
    ).toBe("");
  });
});

describe("formatEventDuration", () => {
  it("uses the same translated minute, hour and mixed labels in sheets and visit forms", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "en", resources: { en: { translation: en } } });
    expect(formatEventDuration(1, i18n.t)).toBe("1 minute");
    expect(formatEventDuration(45, i18n.t)).toBe("45 minutes");
    expect(formatEventDuration(60, i18n.t)).toBe("1 h");
    expect(formatEventDuration(90, i18n.t)).toBe("1 h 30 min");
    expect(formatEventDuration(120, i18n.t)).toBe("2 h");
  });
});

describe("Now card countdown lines", () => {
  it("switches to hours from an hour out, so a later panel never reads as 453 min", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "en", resources: { en: { translation: en } } });
    expect(formatMinutesUntilStart(1, i18n.t)).toBe("1 min until it starts");
    expect(formatMinutesUntilStart(59, i18n.t)).toBe("59 min until it starts");
    expect(formatMinutesUntilStart(60, i18n.t)).toBe("1 h until it starts");
    expect(formatMinutesUntilStart(453, i18n.t)).toBe(
      "7 h 33 min until it starts",
    );
    expect(formatMinutesLeft(12, i18n.t)).toBe("12 min left");
    expect(formatMinutesLeft(150, i18n.t)).toBe("2 h 30 min left");
  });

  describe("formatNowHeroTimes", () => {
    const ZONE = "America/New_York";
    // Sunday, September 20, 10:00 to 11:00 AM in New York.
    const SUNDAY_START = "2026-09-20T14:00:00.000Z";
    const SUNDAY_END = "2026-09-20T15:00:00.000Z";
    const SUNDAY = formatEventDayLabel(SUNDAY_START, ZONE, "en");

    const heroTimes = async (
      overrides: Partial<Parameters<typeof formatNowHeroTimes>[0]>,
    ) => {
      const i18n = createInstance();
      await i18n.init({ lng: "en", resources: { en: { translation: en } } });
      return formatNowHeroTimes({
        kind: "next",
        onAnotherDay: false,
        startTime: SUNDAY_START,
        endTime: SUNDAY_END,
        nowMs: Date.parse(SUNDAY_START),
        timeZone: ZONE,
        locale: "en",
        hour12: true,
        t: i18n.t,
        ...overrides,
      });
    };

    it("names the day, not a 72 h countdown, for a pick three days before the con", async () => {
      // Thursday 3:30 AM in New York: 4,350 minutes before the pick.
      const times = await heroTimes({
        onAnotherDay: true,
        nowMs: Date.parse("2026-09-17T07:30:00.000Z"),
      });

      expect(SUNDAY).toBe("Sunday, September 20");
      expect(times.timeLine).toBe(`${SUNDAY} · 10:00 AM to 11:00 AM`);
      expect(times.callout).toEqual({
        label: "Starts at",
        value: "10:00 AM",
        sub: SUNDAY,
      });
      expect(JSON.stringify(times)).not.toMatch(/72 h|until it starts/);
    });

    it("names the day for tomorrow's pick when nothing is saved for today", async () => {
      // Saturday 2 PM: "Starts at 10:00 AM" alone reads as four hours ago.
      const times = await heroTimes({
        onAnotherDay: true,
        nowMs: Date.parse("2026-09-19T18:00:00.000Z"),
      });

      expect(times.timeLine).toContain(SUNDAY);
      expect(times.callout.sub).toBe(SUNDAY);
      expect(JSON.stringify(times)).not.toMatch(/20 h/);
    });

    it("keeps the countdown and leaves the day out for a pick later today", async () => {
      const times = await heroTimes({
        nowMs: Date.parse(SUNDAY_START) - 453 * 60_000,
      });

      expect(times.timeLine).toBe("10:00 AM to 11:00 AM");
      expect(times.callout).toEqual({
        label: "Starts at",
        value: "10:00 AM",
        sub: "7 h 33 min until it starts",
      });
    });

    it("counts down to the end of a running pick, even one that began yesterday", async () => {
      const times = await heroTimes({
        kind: "current",
        onAnotherDay: true,
        startTime: "2026-09-20T02:00:00.000Z",
        nowMs: Date.parse(SUNDAY_END) - 150 * 60_000,
      });

      expect(times.timeLine).toBe("10:00 PM to Sun 11:00 AM");
      expect(times.callout).toEqual({
        label: "Until",
        value: "Sun 11:00 AM",
        sub: "2 h 30 min left",
      });
    });

    it("says the end is unpublished for a running pick without one", async () => {
      const times = await heroTimes({ kind: "current", endTime: null });

      expect(times.timeLine).toBe("10:00 AM");
      expect(times.callout).toEqual({
        label: "Until",
        value: "End time not published",
      });
    });
  });

  it("keeps the duration placeholder in every language", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../locales");
    for (const file of readdirSync(dir).filter((name) =>
      name.endsWith(".json"),
    )) {
      const now = JSON.parse(readFileSync(path.join(dir, file), "utf8"))
        .convention.now;
      for (const key of ["durationUntil", "durationLeft"]) {
        expect(now[key], `${file} ${key}`).toContain("{{duration}}");
        expect(now[key], `${file} ${key}`).not.toContain("{{count}}");
      }
    }
  });
});
