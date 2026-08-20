import { describe, expect, it } from "vitest";
import {
  createManualEventTimes,
  manualEventDayKey,
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

  it("keeps an included end later than a last-minute start", () => {
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
    expect(manualEventDayKey(includedEnd.endTime)).toBe("2026-09-04");
    expect(correctedEnd.endTime.getTime()).toBeGreaterThan(
      correctedEnd.startTime.getTime(),
    );
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
