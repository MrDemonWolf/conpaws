import { describe, expect, it } from "vitest";
import {
  eventConventionStartHour,
  eventMatchesScheduleSearch,
  eventOccursInConventionHour,
  getNowAndNextEvents,
  type ScheduleViewEvent,
} from "./schedule-view";

describe("eventMatchesScheduleSearch", () => {
  const searchable = {
    title: "Character design",
    description: "Hosted by Milo the Fox",
    category: "Art",
    type: "Panel",
    room: "Cedar",
    location: "Level 1",
  };

  it("finds a presenter's name in the source-backed description", () => {
    expect(eventMatchesScheduleSearch(searchable, "milo")).toBe(true);
    expect(eventMatchesScheduleSearch(searchable, "maple")).toBe(false);
  });
});

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

  it("keeps a planned late join in next after the published start", () => {
    const lateJoin = {
      ...event(
        "late-join",
        "2026-08-17T14:00:00.000Z",
        "2026-08-17T15:30:00.000Z",
        "A",
      ),
      personalStartTime: "2026-08-17T14:35:00.000Z",
      personalEndTime: "2026-08-17T15:20:00.000Z",
    };

    expect(
      getNowAndNextEvents([lateJoin], new Date("2026-08-17T14:18:00.000Z")),
    ).toEqual({ current: [], next: [lateJoin] });
  });

  it("keeps the final active personal stop current with no later event", () => {
    const finalStop = {
      ...event(
        "final",
        "2026-08-17T14:00:00.000Z",
        "2026-08-17T15:30:00.000Z",
        "A",
      ),
      personalEndTime: "2026-08-17T14:25:00.000Z",
    };

    expect(
      getNowAndNextEvents([finalStop], new Date("2026-08-17T14:18:00.000Z")),
    ).toEqual({ current: [finalStop], next: [] });
    expect(
      getNowAndNextEvents([finalStop], new Date("2026-08-17T14:25:00.000Z")),
    ).toEqual({ current: [], next: [] });
  });

  it("filters published sessions by local day and intersecting hour", () => {
    const overnight = event(
      "overnight",
      "2026-08-18T03:30:00.000Z",
      "2026-08-18T05:30:00.000Z",
      "A",
    );

    expect(eventConventionStartHour(overnight, "America/Chicago")).toBe(22);
    expect(
      eventOccursInConventionHour(
        overnight,
        "2026-08-17",
        22,
        "America/Chicago",
      ),
    ).toBe(true);
    expect(
      eventOccursInConventionHour(
        overnight,
        "2026-08-18",
        0,
        "America/Chicago",
      ),
    ).toBe(true);
    expect(
      eventOccursInConventionHour(
        overnight,
        "2026-08-18",
        1,
        "America/Chicago",
      ),
    ).toBe(false);
  });
});
