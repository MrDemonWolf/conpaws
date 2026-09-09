import { describe, expect, it, vi } from "vitest";
import type { Convention, ConventionEvent } from "@/db/schema";
import {
  buildWidgetSnapshot,
  widgetSnapshotForSupportedSchema,
} from "./widget-snapshot";

vi.mock("expo", () => ({ requireOptionalNativeModule: () => null }));
vi.mock("@/db/repositories/conventions", () => ({ getAll: vi.fn() }));
vi.mock("@/db/repositories/events", () => ({ getByConventionId: vi.fn() }));
vi.mock("@/lib/i18n", () => ({
  default: {
    t: (key: string, values: { start?: string; end?: string; lng?: string }) =>
      key.startsWith("convention.ageRatings.")
        ? `pill:${key.split(".").pop()}:${values.lng}`
        : `${values.start} – ${values.end}`,
  },
}));

const convention: Convention = {
  id: "con-1",
  name: "ConPaws",
  startDate: "2026-09-03",
  endDate: "2026-09-06",
  timeZone: "America/Chicago",
  location: null,
  archivedAt: null,
  icalUrl: null,
  status: "upcoming",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

function event(
  id: string,
  startTime: string,
  isInSchedule: boolean,
): ConventionEvent {
  return {
    id,
    conventionId: convention.id,
    title: id,
    description: null,
    startTime,
    endTime: null,
    location: null,
    room: null,
    category: null,
    type: null,
    isInSchedule,
    isInterested: false,
    personalStartTime: null,
    personalEndTime: null,
    reminderMinutes: 15,
    sourceUid: null,
    sourceUrl: null,
    isAgeRestricted: false,
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

describe("buildWidgetSnapshot", () => {
  it("uses convention time and includes only scheduled events in time order", () => {
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([
        [
          convention.id,
          [
            event("later", "2026-09-03T16:00:00-05:00", true),
            event("not-saved", "2026-09-03T14:00:00-05:00", false),
            event("first", "2026-09-03T15:00:00-05:00", true),
          ],
        ],
      ]),
      "en",
      123,
    );

    expect(snapshot.schemaVersion).toBe(3);
    expect(snapshot.generatedAtMs).toBe(123);
    expect(snapshot.conventions[0]?.startAtMs).toBe(
      Date.parse("2026-09-03T00:00:00-05:00"),
    );
    expect(snapshot.conventions[0]?.events.map(({ id }) => id)).toEqual([
      "first",
      "later",
    ]);
  });

  it("keeps an older native extension on its accepted envelope", () => {
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([
        [convention.id, [event("planned", "2026-09-03T15:00:00-05:00", true)]],
      ]),
      "en",
    );

    expect(widgetSnapshotForSupportedSchema(snapshot, undefined)).toMatchObject(
      {
        schemaVersion: 2,
        conventions: [
          {
            events: [
              {
                id: "planned",
                attendanceStartAtMs: Date.parse("2026-09-03T15:00:00-05:00"),
              },
            ],
          },
        ],
      },
    );
    expect(widgetSnapshotForSupportedSchema(snapshot, 3)).toBe(snapshot);
  });

  it("keeps published times and publishes the validated attendance interval", () => {
    const planned = {
      ...event("partial", "2026-09-03T14:00:00-05:00", true),
      endTime: "2026-09-03T15:30:00-05:00",
      personalStartTime: "2026-09-03T14:35:00-05:00",
      personalEndTime: "2026-09-03T15:20:00-05:00",
    };
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([[convention.id, [planned]]]),
      "en",
    );

    expect(snapshot.conventions[0]?.events[0]).toMatchObject({
      startAtMs: Date.parse(planned.startTime),
      endAtMs: Date.parse(planned.endTime),
      attendanceStartAtMs: Date.parse(planned.personalStartTime),
      attendanceEndAtMs: Date.parse(planned.personalEndTime),
      attendanceNeedsReview: false,
    });
  });

  it("flags invalid personal times and gives glance surfaces a safe fallback", () => {
    const changed = {
      ...event("changed", "2026-09-03T14:00:00-05:00", true),
      endTime: "2026-09-03T15:00:00-05:00",
      personalStartTime: "2026-09-03T13:45:00-05:00",
      personalEndTime: "2026-09-03T15:20:00-05:00",
    };
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([[convention.id, [changed]]]),
      "en",
    );

    expect(snapshot.conventions[0]?.events[0]).toMatchObject({
      startAtMs: Date.parse(changed.startTime),
      endAtMs: Date.parse(changed.endTime),
      attendanceStartAtMs: Date.parse(changed.startTime),
      attendanceEndAtMs: Date.parse(changed.endTime),
      attendanceNeedsReview: true,
    });
  });

  it("normalizes a nonpositive published end before crossing the native boundary", () => {
    const invalid = {
      ...event("invalid-end", "2026-09-03T14:00:00-05:00", true),
      endTime: "2026-09-03T13:00:00-05:00",
    };
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([[convention.id, [invalid]]]),
      "en",
    );

    expect(snapshot.conventions[0]?.events[0]).toMatchObject({
      startAtMs: Date.parse(invalid.startTime),
      endAtMs: null,
      attendanceStartAtMs: Date.parse(invalid.startTime),
      attendanceEndAtMs: null,
      attendanceNeedsReview: false,
    });
  });

  it("leaves a saved event out once the feed stops publishing it", () => {
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([
        [
          convention.id,
          [
            {
              ...event("cancelled", "2026-09-03T15:00:00-05:00", true),
              feedStatus: "cancelled" as const,
            },
            {
              ...event("dropped", "2026-09-03T16:00:00-05:00", true),
              feedStatus: "removed" as const,
            },
            event("running", "2026-09-03T17:00:00-05:00", true),
          ],
        ],
      ]),
      "en",
      123,
    );

    // The phone still shows these, marked, because the user needs to know what
    // happened. The widget and the Watch only answer "what is next", and a
    // panel that is not happening is never the answer.
    expect(snapshot.conventions[0]?.events.map(({ id }) => id)).toEqual([
      "running",
    ]);
  });

  it("localizes restrictive age ratings into pill labels and drops the rest", () => {
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([
        [
          convention.id,
          [
            {
              ...event("teen", "2026-09-03T15:00:00-05:00", true),
              ageRating: "teen" as const,
            },
            {
              ...event("adult", "2026-09-03T16:00:00-05:00", true),
              ageRating: "adult" as const,
            },
            {
              ...event("all", "2026-09-03T17:00:00-05:00", true),
              ageRating: "all-ages" as const,
            },
            event("unrated", "2026-09-03T18:00:00-05:00", true),
          ],
        ],
      ]),
      "de",
    );

    expect(
      snapshot.conventions[0]?.events.map(({ id, ageRating }) => [
        id,
        ageRating,
      ]),
    ).toEqual([
      ["teen", "pill:teen:de"],
      ["adult", "pill:adult:de"],
      ["all", null],
      ["unrated", null],
    ]);
  });

  it.each([
    ["2024-02-29", true],
    ["2025-02-29", false],
    ["2026-04-30", true],
    ["2026-04-31", false],
  ])("validates calendar date %s", (date, isValid) => {
    const snapshot = buildWidgetSnapshot(
      [{ ...convention, startDate: date, endDate: date }],
      new Map(),
      "en",
    );

    expect(snapshot.conventions).toHaveLength(isValid ? 1 : 0);
  });
});
