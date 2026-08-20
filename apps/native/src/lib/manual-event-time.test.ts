import { describe, expect, it } from "vitest";
import {
  createManualEventTimes,
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

  it("keeps the end at or after the start", () => {
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
