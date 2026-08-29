import { describe, expect, it } from "vitest";
import { timeSlotBandClass, timeSlotBands } from "./day-band";

describe("timeSlotBands", () => {
  it("chains overlapping events into one block and flips on a gap", () => {
    const bands = timeSlotBands([
      // 19:00-20:00, 19:00-22:00, 20:30-21:00 — the third starts before the
      // second ends, so all three share a block even though the first is over.
      { startTime: "2026-09-03T19:00:00Z", endTime: "2026-09-03T20:00:00Z" },
      { startTime: "2026-09-03T19:00:00Z", endTime: "2026-09-03T22:00:00Z" },
      { startTime: "2026-09-03T20:30:00Z", endTime: "2026-09-03T21:00:00Z" },
      // 22:00 starts exactly when the block ends: new block.
      { startTime: "2026-09-03T22:00:00Z", endTime: "2026-09-03T23:00:00Z" },
      { startTime: "2026-09-03T22:30:00Z", endTime: "2026-09-03T23:30:00Z" },
    ]);
    expect(bands).toEqual([0, 0, 0, 1, 1]);
  });

  it("treats a missing end time as one hour", () => {
    const bands = timeSlotBands([
      { startTime: "2026-09-03T19:00:00Z", endTime: null },
      { startTime: "2026-09-03T19:30:00Z", endTime: null }, // inside the hour
      { startTime: "2026-09-03T21:00:00Z", endTime: null }, // after it
    ]);
    expect(bands).toEqual([0, 0, 1]);
  });

  it("handles an empty day", () => {
    expect(timeSlotBands([])).toEqual([]);
  });
});

describe("timeSlotBandClass", () => {
  it("alternates between the two platform-aware surface tokens", () => {
    expect(timeSlotBandClass(0)).toBe("bg-background");
    expect(timeSlotBandClass(1)).toBe("bg-card");
    expect(timeSlotBandClass(2)).toBe("bg-background");
  });
});
