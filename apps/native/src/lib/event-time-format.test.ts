import { describe, expect, it } from "vitest";
import {
  formatConventionDate,
  formatDayKeyLabel,
  formatEventDayLabel,
  formatEventTime,
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
