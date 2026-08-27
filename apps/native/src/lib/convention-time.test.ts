import { describe, expect, it } from "vitest";
import {
  conventionDayKey,
  conventionStatusForDay,
  formatInConventionTime,
  fromConventionTime,
  isValidTimeZone,
  overlappingEventIds,
} from "./convention-time";

describe("convention time", () => {
  it("uses the convention day when UTC has crossed midnight", () => {
    const instant = "2026-07-16T01:00:00.000Z";

    expect(conventionDayKey(instant, "America/Chicago")).toBe("2026-07-15");
    expect(formatInConventionTime(instant, "America/Chicago", "h:mm a")).toBe(
      "8:00 PM",
    );
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Not/A_Time_Zone")).toBe(false);
  });

  it("resolves wall-clock parts across both DST transitions", () => {
    const timeZone = "America/Chicago";
    const at = (
      year: number,
      month: number,
      day: number,
      hour: number,
      minute = 0,
    ) => fromConventionTime({ year, month, day, hour, minute }, timeZone);

    // Spring forward: 2026-03-08 02:00 CST becomes 03:00 CDT, so an overnight
    // event covering it is an hour shorter than the wall clock suggests.
    expect(at(2026, 3, 7, 23).toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(at(2026, 3, 8, 3).toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(at(2026, 3, 8, 3).getTime() - at(2026, 3, 7, 23).getTime()).toBe(
      3 * 60 * 60 * 1000,
    );

    // Fall back: 2026-11-01 02:00 CDT becomes 01:00 CST, so the same wall
    // clock span covers an extra hour.
    expect(at(2026, 10, 31, 23).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(at(2026, 11, 1, 2).toISOString()).toBe("2026-11-01T08:00:00.000Z");
    expect(at(2026, 11, 1, 2).getTime() - at(2026, 10, 31, 23).getTime()).toBe(
      4 * 60 * 60 * 1000,
    );
  });

  it("shifts a wall-clock time that the spring-forward gap skips", () => {
    // 02:30 does not exist on 2026-03-08 in Chicago. The instant lands an hour
    // later, which is why callers round-trip through formatInConventionTime
    // before saving rather than trusting the parts they asked for.
    const skipped = fromConventionTime(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
      "America/Chicago",
    );

    expect(skipped.toISOString()).toBe("2026-03-08T08:30:00.000Z");
    expect(
      formatInConventionTime(skipped, "America/Chicago", "yyyy-MM-dd HH:mm"),
    ).toBe("2026-03-08 03:30");
  });

  it("classifies convention dates including both boundary days", () => {
    expect(
      conventionStatusForDay("2026-08-20", "2026-08-22", "2026-08-19"),
    ).toBe("upcoming");
    expect(
      conventionStatusForDay("2026-08-20", "2026-08-22", "2026-08-20"),
    ).toBe("active");
    expect(
      conventionStatusForDay("2026-08-20", "2026-08-22", "2026-08-22"),
    ).toBe("active");
    expect(
      conventionStatusForDay("2026-08-20", "2026-08-22", "2026-08-23"),
    ).toBe("ended");
  });

  it("finds arbitrary overlaps without flagging back-to-back events", () => {
    const conflicts = overlappingEventIds([
      {
        id: "long-panel",
        startTime: "2026-07-16T19:00:00.000Z",
        endTime: "2026-07-16T21:00:00.000Z",
      },
      {
        id: "late-start",
        startTime: "2026-07-16T20:30:00.000Z",
        endTime: "2026-07-16T21:30:00.000Z",
      },
      {
        id: "back-to-back",
        startTime: "2026-07-16T21:30:00.000Z",
        endTime: "2026-07-16T22:00:00.000Z",
      },
    ]);

    expect([...conflicts].sort()).toEqual(["late-start", "long-panel"]);
  });
});
