import { describe, expect, it, vi } from "vitest";
import type { Convention, ConventionEvent } from "@/db/schema";
import { buildWidgetSnapshot } from "./widget-snapshot";

vi.mock("expo", () => ({ requireOptionalNativeModule: () => null }));
vi.mock("@/db/repositories/conventions", () => ({ getAll: vi.fn() }));
vi.mock("@/db/repositories/events", () => ({ getByConventionId: vi.fn() }));
vi.mock("@/lib/i18n", () => ({
  default: {
    t: (_key: string, values: { start: string; end: string }) =>
      `${values.start} – ${values.end}`,
  },
}));

const convention: Convention = {
  id: "con-1",
  name: "ConPaws",
  startDate: "2026-09-03",
  endDate: "2026-09-06",
  timeZone: "America/Chicago",
  location: null,
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
    contentWarning: false,
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

    expect(snapshot.generatedAtMs).toBe(123);
    expect(snapshot.conventions[0]?.startAtMs).toBe(
      Date.parse("2026-09-03T00:00:00-05:00"),
    );
    expect(snapshot.conventions[0]?.events.map(({ id }) => id)).toEqual([
      "first",
      "later",
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
