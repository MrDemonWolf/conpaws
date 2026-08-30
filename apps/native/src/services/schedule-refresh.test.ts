import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Convention } from "@/db/schema";

const {
  fetchScheduleIcs,
  parseIcs,
  getByConventionId,
  runScheduleImport,
  publishWidgetSnapshot,
  storage,
} = vi.hoisted(() => ({
  fetchScheduleIcs: vi.fn(),
  parseIcs: vi.fn(),
  getByConventionId: vi.fn(),
  runScheduleImport: vi.fn(),
  publishWidgetSnapshot: vi.fn(),
  storage: {
    getScheduleAutoCheck: vi.fn(),
    getScheduleCheckedAt: vi.fn(),
    getScheduleAllCategories: vi.fn(),
    setScheduleCheckedAt: vi.fn(),
    SCHEDULE_CHECK_INTERVAL_MS: 30 * 60 * 1000,
  },
}));

// The real error class, not a stub: the service does an `instanceof` check to
// tell a cancelled check apart from a failed one, and a stub would never match.
vi.mock("@/lib/sched-extractor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sched-extractor")>()),
  fetchScheduleIcs,
}));
vi.mock("@/lib/ical-parser", () => ({ parseIcs }));
vi.mock("@/db/repositories/events", () => ({ getByConventionId }));
vi.mock("@/hooks/useImportSchedule", () => ({ runScheduleImport }));
vi.mock("@/services/widget-snapshot", () => ({ publishWidgetSnapshot }));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/schedule-refresh-storage", () => storage);

import { refreshConventionSchedule } from "./schedule-refresh";

const NOW = Date.parse("2026-09-03T18:00:00.000Z");

function convention(overrides: Partial<Convention> = {}): Convention {
  return {
    id: "con-1",
    name: "Example Con",
    startDate: "2026-09-03",
    endDate: "2026-09-06",
    timeZone: "America/Chicago",
    location: null,
    archivedAt: null,
    icalUrl: "https://examplecon.org/?ical=1",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** One stored row and a feed that agrees with it, unless a test says otherwise. */
function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    sourceUid: "panel-1",
    startTime: "2026-09-03T20:00:00.000Z",
    endTime: "2026-09-03T21:00:00.000Z",
    room: "Room A",
    location: "Main Hall",
    isInSchedule: true,
    ...overrides,
  };
}

function parsedFeed(overrides: Record<string, unknown> = {}) {
  return {
    requiresTimeZone: false,
    events: [
      {
        sourceUid: "panel-1",
        startTime: new Date("2026-09-03T20:00:00.000Z"),
        endTime: new Date("2026-09-03T21:00:00.000Z"),
        room: "Room A",
        location: "Main Hall",
        legacySourceUid: null,
        recurrenceTime: null,
        title: "Panel",
        sourceUrl: null,
      },
    ],
    cancelledEvents: [],
    cancelledSourceUids: [],
    ...overrides,
  };
}

const deps = { refreshCaches: vi.fn().mockResolvedValue(undefined) };

beforeEach(() => {
  vi.clearAllMocks();
  storage.getScheduleAutoCheck.mockResolvedValue(true);
  storage.getScheduleCheckedAt.mockResolvedValue(null);
  storage.getScheduleAllCategories.mockResolvedValue(true);
  storage.setScheduleCheckedAt.mockResolvedValue(undefined);
  publishWidgetSnapshot.mockResolvedValue(true);
  deps.refreshCaches.mockResolvedValue(undefined);
  getByConventionId.mockResolvedValue([storedRow()]);
  fetchScheduleIcs.mockResolvedValue({ icsContent: "BEGIN:VCALENDAR" });
  parseIcs.mockReturnValue(parsedFeed());
  runScheduleImport.mockResolvedValue({
    added: 0,
    updated: 1,
    removed: 0,
    tombstoned: 0,
    unresolved: 0,
    remindersCleared: 0,
    remindersPaused: 0,
  });
});

describe("refreshConventionSchedule gates", () => {
  it.each([
    ["a convention with no saved feed", { icalUrl: null }],
    ["a convention that has ended", { status: "ended" as const }],
    ["an archived convention", { archivedAt: "2026-09-07T00:00:00.000Z" }],
  ])("never reaches the network for %s", async (_label, overrides) => {
    const result = await refreshConventionSchedule(
      convention(overrides),
      deps,
      { now: NOW },
    );

    expect(result).toEqual({ status: "skipped" });
    expect(fetchScheduleIcs).not.toHaveBeenCalled();
  });

  it("does nothing when the setting is off", async () => {
    storage.getScheduleAutoCheck.mockResolvedValue(false);

    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "skipped" });
    expect(fetchScheduleIcs).not.toHaveBeenCalled();
  });

  it("honours the interval, and lets an explicit check through it", async () => {
    storage.getScheduleCheckedAt.mockResolvedValue(NOW - 60_000);

    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "skipped" });
    expect(fetchScheduleIcs).not.toHaveBeenCalled();

    const forced = await refreshConventionSchedule(convention(), deps, {
      now: NOW,
      force: true,
    });

    expect(forced.status).toBe("unchanged");
    expect(fetchScheduleIcs).toHaveBeenCalledTimes(1);
  });

  it("stays out of a convention whose last import left categories out", async () => {
    // Applying the whole feed would silently reinstate what the user removed.
    storage.getScheduleAllCategories.mockResolvedValue(false);

    expect(
      await refreshConventionSchedule(convention(), deps, {
        now: NOW,
        force: true,
      }),
    ).toEqual({ status: "skipped" });
    expect(fetchScheduleIcs).not.toHaveBeenCalled();
  });
});

describe("refreshConventionSchedule outcomes", () => {
  it("reports an unchanged feed and stamps the check", async () => {
    const result = await refreshConventionSchedule(convention(), deps, {
      now: NOW,
    });

    expect(result).toEqual({ status: "unchanged", checkedAt: NOW });
    expect(storage.setScheduleCheckedAt).toHaveBeenCalledWith("con-1", NOW);
    expect(runScheduleImport).not.toHaveBeenCalled();
  });

  it("applies a moved panel and refreshes what reads it", async () => {
    parseIcs.mockReturnValue(
      parsedFeed({
        events: [
          {
            ...parsedFeed().events[0],
            startTime: new Date("2026-09-03T22:00:00.000Z"),
          },
        ],
      }),
    );

    const result = await refreshConventionSchedule(convention(), deps, {
      now: NOW,
    });

    expect(result).toEqual({
      status: "applied",
      checkedAt: NOW,
      summary: { moved: 1, gone: 0, savedMoved: 1, savedGone: 0 },
    });
    expect(runScheduleImport).toHaveBeenCalledTimes(1);
    expect(publishWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.refreshCaches).toHaveBeenCalledWith("con-1");
  });

  it("takes the removal count from the write, not the comparison", async () => {
    // The planner resolves series identities the flat comparison cannot see,
    // so its tombstone count is the one the user is shown.
    parseIcs.mockReturnValue(parsedFeed({ events: [] }));
    getByConventionId.mockResolvedValue([
      storedRow(),
      ...Array.from({ length: 9 }, (_, index) =>
        storedRow({
          id: `filler-${index}`,
          sourceUid: `panel-${index + 10}`,
          isInSchedule: false,
        }),
      ),
    ]);

    // An empty feed never applies at all — that is the point of this guard.
    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "untrusted", checkedAt: NOW });
    expect(runScheduleImport).not.toHaveBeenCalled();
  });

  it("stamps an untrusted feed so a broken link is not re-fetched on every glance", async () => {
    parseIcs.mockReturnValue(parsedFeed({ events: [] }));

    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "untrusted", checkedAt: NOW });
    expect(storage.setScheduleCheckedAt).toHaveBeenCalledWith("con-1", NOW);
  });
});

describe("refreshConventionSchedule failures are silent", () => {
  it("swallows a network failure", async () => {
    fetchScheduleIcs.mockRejectedValue(new Error("Network request failed"));

    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "failed" });
    expect(storage.setScheduleCheckedAt).not.toHaveBeenCalled();
  });

  it("swallows an unparseable feed", async () => {
    parseIcs.mockImplementation(() => {
      throw new Error("UnsupportedRecurrenceError");
    });

    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "failed" });
  });

  it("refuses a feed that needs a time zone it was not given", async () => {
    // Guessing would shift every event and report the schedule as fully moved.
    parseIcs.mockReturnValue(parsedFeed({ requiresTimeZone: true }));

    expect(
      await refreshConventionSchedule(convention({ timeZone: null }), deps, {
        now: NOW,
      }),
    ).toEqual({ status: "failed" });
    expect(runScheduleImport).not.toHaveBeenCalled();
  });

  it("claims nothing when the write itself fails", async () => {
    parseIcs.mockReturnValue(
      parsedFeed({
        events: [{ ...parsedFeed().events[0], room: "Room B" }],
      }),
    );
    runScheduleImport.mockRejectedValue(new Error("database is locked"));

    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "failed" });
    // No stamp: the next glance should retry rather than wait out the interval.
    expect(storage.setScheduleCheckedAt).not.toHaveBeenCalled();
  });
});
