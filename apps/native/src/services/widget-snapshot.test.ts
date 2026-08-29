import { describe, expect, it, vi } from "vitest";
import type { Convention, ConventionEvent } from "@/db/schema";
import { buildWidgetSnapshot } from "./widget-snapshot";

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

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.generatedAtMs).toBe(123);
    expect(snapshot.conventions[0]?.startAtMs).toBe(
      Date.parse("2026-09-03T00:00:00-05:00"),
    );
    expect(snapshot.conventions[0]?.events.map(({ id }) => id)).toEqual([
      "first",
      "later",
    ]);
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
