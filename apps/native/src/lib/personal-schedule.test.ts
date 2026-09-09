import { describe, expect, it } from "vitest";
import {
  attendanceInterval,
  attendanceSeparationMinutes,
  attendanceTimeError,
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

describe("attendanceInterval", () => {
  const published = {
    startTime: "2026-07-03T23:30:00Z",
    endTime: "2026-07-04T01:00:00Z",
  };

  it("uses personal timestamps without changing cross-midnight published times", () => {
    const choice = {
      ...published,
      personalStartTime: "2026-07-03T23:45:00Z",
      personalEndTime: "2026-07-04T00:30:00Z",
    };

    expect(attendanceInterval(choice)).toEqual({
      startTime: choice.personalStartTime,
      endTime: choice.personalEndTime,
      needsReview: false,
    });
    expect(published).toEqual({
      startTime: "2026-07-03T23:30:00Z",
      endTime: "2026-07-04T01:00:00Z",
    });
  });

  it("falls back independently and permits a leave time when the end is unknown", () => {
    expect(
      attendanceInterval({
        startTime: published.startTime,
        endTime: null,
        personalEndTime: "2026-07-04T00:30:00Z",
      }),
    ).toEqual({
      startTime: published.startTime,
      endTime: "2026-07-04T00:30:00Z",
      needsReview: false,
    });
  });

  it("treats a nonpositive published end as unknown when validating a leave time", () => {
    const choice = {
      startTime: "2026-07-03T14:00:00Z",
      endTime: "2026-07-03T13:00:00Z",
      personalEndTime: "2026-07-03T14:30:00Z",
    };

    expect(attendanceTimeError(choice)).toBeNull();
    expect(attendanceInterval(choice)).toEqual({
      startTime: choice.startTime,
      endTime: choice.personalEndTime,
      needsReview: false,
    });
  });

  it.each([
    [
      "before-event-start",
      { ...published, personalStartTime: "2026-07-03T23:29:00Z" },
    ],
    [
      "after-event-end",
      { ...published, personalEndTime: "2026-07-04T01:01:00Z" },
    ],
    [
      "start-not-before-end",
      {
        ...published,
        personalStartTime: "2026-07-04T00:30:00Z",
        personalEndTime: "2026-07-04T00:30:00Z",
      },
    ],
    ["invalid-time", { ...published, personalStartTime: "later" }],
  ] as const)("reports %s and uses safe published bounds", (error, choice) => {
    expect(attendanceTimeError(choice)).toBe(error);
    expect(attendanceInterval(choice)).toEqual({
      startTime: published.startTime,
      endTime: published.endTime,
      needsReview: true,
    });
  });

  it("derives review after an organizer moves the published bounds", () => {
    const choice = {
      startTime: "2026-07-04T00:00:00Z",
      endTime: "2026-07-04T01:00:00Z",
      personalStartTime: "2026-07-03T23:45:00Z",
      personalEndTime: "2026-07-04T00:30:00Z",
    };

    expect(attendanceInterval(choice)).toEqual({
      startTime: choice.startTime,
      endTime: choice.endTime,
      needsReview: true,
    });
  });

  it("measures the real gap between personal attendance intervals", () => {
    expect(
      attendanceSeparationMinutes(
        {
          startTime: "2026-07-03T14:00:00Z",
          endTime: "2026-07-03T15:00:00Z",
          personalEndTime: "2026-07-03T14:25:00Z",
        },
        {
          startTime: "2026-07-03T14:00:00Z",
          endTime: "2026-07-03T15:30:00Z",
          personalStartTime: "2026-07-03T14:35:00Z",
        },
      ),
    ).toBe(10);
    expect(
      attendanceSeparationMinutes(published, {
        startTime: published.endTime,
        endTime: "2026-07-04T02:00:00Z",
      }),
    ).toBe(0);
    expect(
      attendanceSeparationMinutes(
        { startTime: published.startTime, endTime: null },
        published,
      ),
    ).toBeNull();
  });
});

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

  it("uses personal attendance timestamps for ordering and completion", () => {
    const groups = groupPersonalScheduleByDay(
      [
        entry({
          id: "published-first",
          startTime: "2026-07-03T12:30:00Z",
          endTime: "2026-07-03T14:00:00Z",
          personalStartTime: "2026-07-03T13:30:00Z",
        }),
        entry({
          id: "personal-first",
          startTime: "2026-07-03T13:00:00Z",
          endTime: "2026-07-03T14:00:00Z",
        }),
        entry({
          id: "personally-finished",
          startTime: "2026-07-03T11:30:00Z",
          endTime: "2026-07-03T13:00:00Z",
          personalEndTime: "2026-07-03T11:59:00Z",
        }),
      ],
      NOW,
    );

    expect(
      groups.flatMap((group) => group.data).map((event) => event.id),
    ).toEqual(["personal-first", "published-first"]);
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
