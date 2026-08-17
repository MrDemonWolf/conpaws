import { describe, expect, it, vi } from "vitest";
import type { ExportPayload } from "./data-export";
import { planDataImport } from "./data-import";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("expo-document-picker", () => ({}));
vi.mock("expo-file-system", () => ({ File: class {} }));
vi.mock("react-native", () => ({ Alert: { alert: vi.fn() } }));

const payload: ExportPayload = {
  version: 1,
  exportedAt: "2026-08-17T00:00:00.000Z",
  app: "ConPaws",
  data: {
    conventions: [
      {
        id: "convention-export-id",
        name: "Test Con",
        startDate: "2026-08-21",
        endDate: "2026-08-23",
        timeZone: "America/Chicago",
        icalUrl: "https://testcon.sched.com",
        status: "upcoming",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-export-id",
        conventionId: "convention-export-id",
        title: "Opening",
        description: null,
        startTime: "2026-08-21T15:00:00.000Z",
        endTime: "2026-08-21T16:00:00.000Z",
        location: "Convention Center",
        room: "Main Stage",
        category: "Convention Services",
        type: null,
        isInSchedule: true,
        reminderMinutes: 15,
        sourceUid: "opening-event",
        sourceUrl: null,
        isAgeRestricted: false,
        contentWarning: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
};

describe("backup import planning", () => {
  it("preserves IDs and makes a second identical import a no-op", () => {
    const first = planDataImport(payload, new Set(), new Set());

    expect(first.result).toEqual({
      conventionsAdded: 1,
      eventsAdded: 1,
      skipped: 0,
    });
    expect(first.conventions[0].id).toBe("convention-export-id");
    expect(first.events[0]).toMatchObject({
      id: "event-export-id",
      conventionId: "convention-export-id",
      reminderMinutes: null,
    });

    const second = planDataImport(
      payload,
      new Set(first.conventions.map((convention) => convention.id)),
      new Set(first.events.map((event) => event.id)),
    );

    expect(second.conventions).toEqual([]);
    expect(second.events).toEqual([]);
    expect(second.result).toEqual({
      conventionsAdded: 0,
      eventsAdded: 0,
      skipped: 2,
    });
  });
});
