import { describe, expect, it } from "vitest";
import { fromConventionTime } from "./convention-time";
import {
  createManualEventTimes,
  manualEventDayKey,
  manualEventTimeParts,
  resolveManualEventInstant,
  updateManualEventDate,
  updateManualEventEnd,
  updateManualEventStart,
  validatedManualEventEnd,
} from "./manual-event-time";

function localStamp(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
    String(value.getHours()).padStart(2, "0"),
    String(value.getMinutes()).padStart(2, "0"),
  ].join("-");
}

describe("manual event picker times", () => {
  it("clamps the initial and selected date to the convention dates", () => {
    const initial = createManualEventTimes(
      "2026-09-01",
      "2026-09-03",
      "2026-09-06",
    );
    expect(localStamp(initial.date)).toBe("2026-09-03-12-00");

    const beforeConvention = new Date(2026, 7, 20, 12);
    const afterConvention = new Date(2026, 9, 20, 12);
    expect(
      localStamp(
        updateManualEventDate(
          initial,
          beforeConvention,
          "2026-09-03",
          "2026-09-06",
        ).date,
      ),
    ).toBe("2026-09-03-12-00");
    expect(
      localStamp(
        updateManualEventDate(
          initial,
          afterConvention,
          "2026-09-03",
          "2026-09-06",
        ).date,
      ),
    ).toBe("2026-09-06-12-00");
  });

  it("keeps the end later than the start", () => {
    const initial = createManualEventTimes(
      "2026-09-04",
      "2026-09-03",
      "2026-09-06",
    );
    const lateStart = new Date(2026, 8, 4, 16, 30);
    const afterStart = updateManualEventStart(initial, lateStart);
    expect(localStamp(afterStart.startTime)).toBe("2026-09-04-16-30");
    expect(afterStart.endTime.getTime()).toBeGreaterThanOrEqual(
      afterStart.startTime.getTime(),
    );

    const earlierEnd = new Date(2026, 8, 4, 8);
    const clampedEnd = updateManualEventEnd(afterStart, earlierEnd);
    expect(clampedEnd.endTime.getTime()).toBeGreaterThan(
      clampedEnd.startTime.getTime(),
    );
  });

  it("keeps a last-minute start where the user put it and rolls the end past midnight", () => {
    const initial = createManualEventTimes(
      "2026-09-04",
      "2026-09-03",
      "2026-09-06",
    );
    const lastMinute = new Date(2026, 8, 4, 23, 59);
    const optionalEnd = updateManualEventStart(initial, lastMinute, false);
    const includedEnd = updateManualEventStart(
      optionalEnd,
      optionalEnd.startTime,
      true,
    );
    const selectedEnd = updateManualEventEnd(initial, lastMinute);
    const correctedEnd = updateManualEventEnd(
      { ...selectedEnd, startTime: lastMinute },
      lastMinute,
    );

    expect(localStamp(optionalEnd.startTime)).toBe("2026-09-04-23-59");
    expect(includedEnd.endTime.getTime()).toBeGreaterThan(
      includedEnd.startTime.getTime(),
    );
    expect(localStamp(includedEnd.startTime)).toBe("2026-09-04-23-59");
    expect(localStamp(includedEnd.endTime)).toBe("2026-09-05-00-00");
    expect(correctedEnd.endTime.getTime()).toBeGreaterThan(
      correctedEnd.startTime.getTime(),
    );
  });

  it("rolls an end earlier in the clock than the start into the next day", () => {
    const initial = createManualEventTimes(
      "2026-09-04",
      "2026-09-03",
      "2026-09-06",
    );
    const dance = updateManualEventEnd(
      updateManualEventStart(initial, new Date(2026, 8, 4, 22, 0)),
      new Date(2026, 8, 4, 1, 0),
    );

    expect(localStamp(dance.startTime)).toBe("2026-09-04-22-00");
    expect(localStamp(dance.endTime)).toBe("2026-09-05-01-00");
    expect(manualEventDayKey(dance.endTime)).toBe("2026-09-05");
    expect(dance.endTime.getTime() - dance.startTime.getTime()).toBe(
      3 * 60 * 60 * 1000,
    );
  });

  it("keeps an overnight event overnight when the date moves", () => {
    const initial = createManualEventTimes(
      "2026-09-04",
      "2026-09-03",
      "2026-09-06",
    );
    const dance = updateManualEventEnd(
      updateManualEventStart(initial, new Date(2026, 8, 4, 22, 0)),
      new Date(2026, 8, 4, 1, 0),
    );
    const moved = updateManualEventDate(
      dance,
      new Date(2026, 8, 5, 12),
      "2026-09-03",
      "2026-09-06",
    );

    expect(localStamp(moved.startTime)).toBe("2026-09-05-22-00");
    expect(localStamp(moved.endTime)).toBe("2026-09-06-01-00");
  });

  it("resolves an overnight event across a convention-zone DST change", () => {
    // Chicago springs forward at 02:00 on 2026-03-08, so 23:00 to 03:00 is
    // four hours on the wall clock but only three hours of real time.
    const initial = createManualEventTimes(
      "2026-03-07",
      "2026-03-06",
      "2026-03-09",
    );
    const overnight = updateManualEventEnd(
      updateManualEventStart(initial, new Date(2026, 2, 7, 23, 0)),
      new Date(2026, 2, 7, 3, 0),
    );

    expect(localStamp(overnight.startTime)).toBe("2026-03-07-23-00");
    expect(localStamp(overnight.endTime)).toBe("2026-03-08-03-00");

    const timeZone = "America/Chicago";
    const start = fromConventionTime(
      manualEventTimeParts(overnight.startTime),
      timeZone,
    );
    const end = fromConventionTime(
      manualEventTimeParts(overnight.endTime),
      timeZone,
    );

    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-08T08:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(3 * 60 * 60 * 1000);
  });

  it("keeps the end optional and rejects a zero-duration event", () => {
    const start = new Date("2026-09-04T14:00:00.000Z");
    const end = new Date("2026-09-04T15:00:00.000Z");

    expect(validatedManualEventEnd(start, end, false)).toBeNull();
    expect(validatedManualEventEnd(start, end, true)).toBe(end);
    expect(() => validatedManualEventEnd(start, start, true)).toThrow(
      "End time must be later than start time",
    );
  });
});

describe("resolveManualEventInstant", () => {
  const timeZone = "America/Chicago";

  it("resolves an ordinary wall clock", () => {
    const instant = resolveManualEventInstant(
      { year: 2026, month: 9, day: 4, hour: 14, minute: 30 },
      timeZone,
    );

    expect(instant?.toISOString()).toBe("2026-09-04T19:30:00.000Z");
  });

  it("rejects a wall clock inside the spring-forward gap", () => {
    // 2026-03-08 skips 02:00 to 03:00 in US Central, so 02:30 never happens.
    expect(
      resolveManualEventInstant(
        { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
        timeZone,
      ),
    ).toBeNull();
  });

  it("accepts the hour on either side of the spring-forward gap", () => {
    expect(
      resolveManualEventInstant(
        { year: 2026, month: 3, day: 8, hour: 1, minute: 30 },
        timeZone,
      )?.toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");
    expect(
      resolveManualEventInstant(
        { year: 2026, month: 3, day: 8, hour: 3, minute: 30 },
        timeZone,
      )?.toISOString(),
    ).toBe("2026-03-08T08:30:00.000Z");
  });

  it("resolves an ambiguous fall-back hour to one of its two instants", () => {
    // 2026-11-01 repeats 01:00 to 02:00 in US Central. Either instant renders
    // back as the wall clock the user picked, so the guard must not reject it.
    const instant = resolveManualEventInstant(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
      timeZone,
    );

    expect(instant).not.toBeNull();
    expect(["2026-11-01T06:30:00.000Z", "2026-11-01T07:30:00.000Z"]).toContain(
      instant?.toISOString(),
    );
  });
});
