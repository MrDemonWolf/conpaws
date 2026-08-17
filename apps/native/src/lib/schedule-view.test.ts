import { describe, expect, it } from "vitest";
import { getNowAndNextEvents, type ScheduleViewEvent } from "./schedule-view";

function event(
  id: string,
  startTime: string,
  endTime: string | null,
  room: string,
): ScheduleViewEvent {
  return { id, title: id, startTime, endTime, room };
}

describe("getNowAndNextEvents", () => {
  it("returns every current overlap and every event tied for next", () => {
    const result = getNowAndNextEvents(
      [
        event(
          "current-b",
          "2026-08-17T15:15:00.000Z",
          "2026-08-17T16:30:00.000Z",
          "B",
        ),
        event(
          "next-b",
          "2026-08-17T17:00:00.000Z",
          "2026-08-17T18:00:00.000Z",
          "B",
        ),
        event(
          "current-a",
          "2026-08-17T15:00:00.000Z",
          "2026-08-17T16:00:00.000Z",
          "A",
        ),
        event(
          "later",
          "2026-08-17T18:00:00.000Z",
          "2026-08-17T19:00:00.000Z",
          "A",
        ),
        event(
          "next-a",
          "2026-08-17T17:00:00.000Z",
          "2026-08-17T18:00:00.000Z",
          "A",
        ),
      ],
      new Date("2026-08-17T15:30:00.000Z"),
    );

    expect(result.current.map(({ id }) => id)).toEqual([
      "current-a",
      "current-b",
    ]);
    expect(result.next.map(({ id }) => id)).toEqual(["next-a", "next-b"]);
  });

  it("uses half-open intervals so back-to-back events do not overlap", () => {
    const result = getNowAndNextEvents(
      [
        event(
          "ended",
          "2026-08-17T14:00:00.000Z",
          "2026-08-17T15:00:00.000Z",
          "A",
        ),
        event(
          "started",
          "2026-08-17T15:00:00.000Z",
          "2026-08-17T16:00:00.000Z",
          "B",
        ),
      ],
      new Date("2026-08-17T15:00:00.000Z"),
    );

    expect(result.current.map(({ id }) => id)).toEqual(["started"]);
    expect(result.next).toEqual([]);
  });

  it("treats events without an end as current for a 60-minute fallback", () => {
    const result = getNowAndNextEvents(
      [
        event("invalid", "not-a-date", null, "A"),
        event("no-end", "2026-08-17T14:30:00.000Z", null, "B"),
      ],
      new Date("2026-08-17T15:00:00.000Z"),
    );

    expect(result.current.map(({ id }) => id)).toEqual(["no-end"]);
    expect(result.next).toEqual([]);
  });

  it("expires the no-end fallback at its half-open 60-minute boundary", () => {
    const result = getNowAndNextEvents(
      [event("no-end", "2026-08-17T14:00:00.000Z", null, "B")],
      new Date("2026-08-17T15:00:00.000Z"),
    );

    expect(result).toEqual({ current: [], next: [] });
  });
});
