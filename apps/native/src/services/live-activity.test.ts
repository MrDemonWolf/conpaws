import { describe, expect, it, vi } from "vitest";
import {
  endLiveActivity,
  projectLiveActivity,
  startOrUpdateLiveActivity,
} from "./live-activity";
import type { WidgetEventSnapshot, WidgetSnapshot } from "./widget-snapshot";

const nativeMocks = vi.hoisted(() => ({
  startOrUpdateLiveActivity: vi.fn(),
  endLiveActivity: vi.fn(),
  getLiveActivityStatus: vi.fn(),
}));

vi.mock("expo", () => ({
  requireOptionalNativeModule: () => nativeMocks,
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/db/repositories/conventions", () => ({ getAll: vi.fn() }));
vi.mock("@/db/repositories/events", () => ({ getByConventionId: vi.fn() }));
vi.mock("@/lib/i18n", () => ({
  default: { language: "en", resolvedLanguage: "en", t: vi.fn() },
}));

const now = Date.parse("2026-09-19T19:18:00.000Z");

function event(
  id: string,
  start: string,
  end: string | null,
  attendanceStart = start,
  attendanceEnd = end,
): WidgetEventSnapshot {
  return {
    id,
    title: id,
    startAtMs: Date.parse(start),
    endAtMs: end ? Date.parse(end) : null,
    attendanceStartAtMs: Date.parse(attendanceStart),
    attendanceEndAtMs: attendanceEnd ? Date.parse(attendanceEnd) : null,
    attendanceNeedsReview: false,
    location: "Convention Center",
    room: `${id} room`,
    reminderMinutes: null,
    ageRating: null,
  };
}

function snapshot(events: WidgetEventSnapshot[]): WidgetSnapshot {
  return {
    schemaVersion: 3,
    generatedAtMs: now,
    localeIdentifier: "en",
    conventions: [
      {
        id: "convention",
        name: "Lakeside Fur Con",
        startAtMs: now - 86_400_000,
        endAtMs: now + 86_400_000,
        timeZoneIdentifier: "UTC",
        dateRangeLabel: "September 18–20",
        events,
      },
    ],
  };
}

describe("projectLiveActivity", () => {
  it("keeps the final currently active panel without requiring a later pick", () => {
    const projected = projectLiveActivity(
      snapshot([
        event("final", "2026-09-19T19:00:00.000Z", "2026-09-19T20:00:00.000Z"),
      ]),
      now,
    );

    expect(projected?.content).toMatchObject({
      phase: "current",
      eventId: "final",
      nextEventTitle: null,
    });
  });

  it("keeps a planned late join upcoming after the published start", () => {
    const projected = projectLiveActivity(
      snapshot([
        event(
          "late",
          "2026-09-19T19:00:00.000Z",
          "2026-09-19T20:30:00.000Z",
          "2026-09-19T19:35:00.000Z",
          "2026-09-19T20:20:00.000Z",
        ),
      ]),
      now,
    );

    expect(projected?.content).toMatchObject({
      phase: "upcoming",
      eventId: "late",
      hasPersonalStart: true,
      publishedStartAtMs: Date.parse("2026-09-19T19:00:00.000Z"),
      attendanceStartAtMs: Date.parse("2026-09-19T19:35:00.000Z"),
    });
  });

  it("shows leave when an explicit personal leave time is due", () => {
    const projected = projectLiveActivity(
      snapshot([
        event(
          "current",
          "2026-09-19T19:00:00.000Z",
          "2026-09-19T20:00:00.000Z",
          "2026-09-19T19:00:00.000Z",
          "2026-09-19T19:18:30.000Z",
        ),
        event("next", "2026-09-19T19:20:00.000Z", "2026-09-19T20:20:00.000Z"),
      ]),
      now,
    );

    expect(projected?.content).toMatchObject({
      phase: "leave",
      eventId: "current",
      hasPersonalEnd: true,
      nextEventTitle: "next",
      nextAttendanceStartAtMs: Date.parse("2026-09-19T19:20:00.000Z"),
    });
  });

  it("skips an empty active convention for a later convention with picks", () => {
    const value = snapshot([]);
    const activeConvention = value.conventions[0];
    if (!activeConvention)
      throw new Error("Snapshot fixture needs a convention");
    value.conventions.push({
      ...activeConvention,
      id: "later-convention",
      name: "Later Con",
      startAtMs: now + 86_400_000,
      endAtMs: now + 172_800_000,
      events: [
        event(
          "later-pick",
          "2026-09-20T19:18:00.000Z",
          "2026-09-20T20:18:00.000Z",
        ),
      ],
    });

    expect(projectLiveActivity(value, now)).toMatchObject({
      conventionId: "later-convention",
      content: { phase: "upcoming", eventId: "later-pick" },
    });
  });
});

describe("ActivityKit bridge", () => {
  it("starts only when explicitly requested and forwards the projection", async () => {
    nativeMocks.startOrUpdateLiveActivity.mockResolvedValue({
      availability: "available",
      active: true,
      phase: "current",
    });
    const status = await startOrUpdateLiveActivity(
      snapshot([
        event(
          "current",
          "2026-09-19T19:00:00.000Z",
          "2026-09-19T20:00:00.000Z",
        ),
      ]),
      now,
    );

    expect(nativeMocks.startOrUpdateLiveActivity).toHaveBeenCalledOnce();
    expect(
      JSON.parse(nativeMocks.startOrUpdateLiveActivity.mock.calls[0]?.[0]),
    ).toMatchObject({
      conventionId: "convention",
      content: {
        phase: "current",
        eventId: "current",
        localeIdentifier: "en",
        timeZoneIdentifier: "UTC",
      },
    });
    expect(status.active).toBe(true);
  });

  it("ends cleanly through the same optional native bridge", async () => {
    nativeMocks.endLiveActivity.mockResolvedValue({
      availability: "available",
      active: false,
      phase: "finished",
    });
    await expect(endLiveActivity()).resolves.toMatchObject({ active: false });
    expect(nativeMocks.endLiveActivity).toHaveBeenCalledWith(true);
  });
});
