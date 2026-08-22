import { describe, expect, it } from "vitest";
import {
  groupPersonalScheduleByDay,
  type PersonalScheduleEntry,
  spansMultipleConventions,
} from "./personal-schedule";

function entry(
  overrides: Partial<PersonalScheduleEntry> & { id: string; startTime: string },
): PersonalScheduleEntry {
  return {
    conventionId: "con_a",
    conventionName: "Aurora Fur Fest",
    timeZone: "America/New_York",
    endTime: null,
    ...overrides,
  };
}

const NOW = new Date("2026-07-03T12:00:00Z");

describe("groupPersonalScheduleByDay", () => {
  it("groups by the convention's own day, not the device's", () => {
    // 01:30 UTC on the 4th is still the evening of the 3rd in New York.
    const groups = groupPersonalScheduleByDay(
      [entry({ id: "a", startTime: "2026-07-04T01:30:00Z" })],
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2026-07-03");
  });

  it("orders across time zones by the real instant, not the clock face", () => {
    // Both read "09:00" locally; Berlin's is six hours earlier in real time.
    const groups = groupPersonalScheduleByDay(
      [
        entry({
          id: "denver",
          conventionId: "con_b",
          conventionName: "Mountain Howl",
          timeZone: "America/Denver",
          startTime: "2026-07-04T15:00:00Z",
        }),
        entry({
          id: "berlin",
          conventionId: "con_c",
          conventionName: "Rheinfell",
          timeZone: "Europe/Berlin",
          startTime: "2026-07-04T07:00:00Z",
        }),
      ],
      NOW,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2026-07-04");
    expect(groups[0].data.map((event) => event.id)).toEqual([
      "berlin",
      "denver",
    ]);
  });

  it("drops events that already ended", () => {
    const groups = groupPersonalScheduleByDay(
      [
        entry({
          id: "over",
          startTime: "2026-07-03T09:00:00Z",
          endTime: "2026-07-03T10:00:00Z",
        }),
        entry({ id: "ahead", startTime: "2026-07-03T18:00:00Z" }),
      ],
      NOW,
    );

    expect(groups.flatMap((group) => group.data).map((e) => e.id)).toEqual([
      "ahead",
    ]);
  });

  it("keeps an in-progress event with no end time for an hour", () => {
    const running = groupPersonalScheduleByDay(
      [entry({ id: "running", startTime: "2026-07-03T11:30:00Z" })],
      NOW,
    );
    expect(running.flatMap((group) => group.data)).toHaveLength(1);

    const finished = groupPersonalScheduleByDay(
      [entry({ id: "finished", startTime: "2026-07-03T10:59:00Z" })],
      NOW,
    );
    expect(finished).toEqual([]);
  });

  it("treats an end time that is not after the start as missing", () => {
    const groups = groupPersonalScheduleByDay(
      [
        entry({
          id: "backwards",
          startTime: "2026-07-03T11:30:00Z",
          endTime: "2026-07-03T11:00:00Z",
        }),
      ],
      NOW,
    );

    expect(groups.flatMap((group) => group.data).map((e) => e.id)).toEqual([
      "backwards",
    ]);
  });

  it("skips entries with an unparseable start time", () => {
    expect(
      groupPersonalScheduleByDay(
        [entry({ id: "junk", startTime: "soon" })],
        NOW,
      ),
    ).toEqual([]);
  });

  it("returns days in chronological order", () => {
    const groups = groupPersonalScheduleByDay(
      [
        entry({ id: "later", startTime: "2026-07-05T14:00:00Z" }),
        entry({ id: "sooner", startTime: "2026-07-04T14:00:00Z" }),
      ],
      NOW,
    );

    expect(groups.map((group) => group.key)).toEqual([
      "2026-07-04",
      "2026-07-05",
    ]);
  });
});

describe("spansMultipleConventions", () => {
  it("is false for an empty or single-convention schedule", () => {
    expect(spansMultipleConventions([])).toBe(false);
    expect(
      spansMultipleConventions([
        entry({ id: "a", startTime: "2026-07-04T14:00:00Z" }),
        entry({ id: "b", startTime: "2026-07-04T15:00:00Z" }),
      ]),
    ).toBe(false);
  });

  it("is true once a second convention appears", () => {
    expect(
      spansMultipleConventions([
        entry({ id: "a", startTime: "2026-07-04T14:00:00Z" }),
        entry({
          id: "b",
          conventionId: "con_b",
          conventionName: "Mountain Howl",
          startTime: "2026-07-04T15:00:00Z",
        }),
      ]),
    ).toBe(true);
  });
});
