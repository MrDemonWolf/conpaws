import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Convention } from "@/db/schema";

const {
  fetchScheduleIcs,
  parseIcs,
  getByConventionId,
  catalogSchedule,
  updateConvention,
  runScheduleImport,
  publishWidgetSnapshot,
  storage,
} = vi.hoisted(() => ({
  fetchScheduleIcs: vi.fn(),
  parseIcs: vi.fn(),
  getByConventionId: vi.fn(),
  catalogSchedule: vi.fn(),
  updateConvention: vi.fn(),
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
vi.mock("@/db/repositories/conventions", () => ({ update: updateConvention }));
vi.mock("@/lib/catalog/source-preference", () => ({
  resolveCatalogSource: () => ({
    kind: "http",
    list: vi.fn(),
    schedule: catalogSchedule,
  }),
}));
vi.mock("@/hooks/useImportSchedule", () => ({ runScheduleImport }));
vi.mock("@/services/widget-snapshot", () => ({ publishWidgetSnapshot }));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/schedule-refresh-storage", () => storage);

import { buildIcsFromEcpEvents, normalizeEcpUids } from "@/lib/ecp-feed";
import {
  canCheckSchedule,
  hasScheduleSource,
  refreshConventionSchedule,
} from "./schedule-refresh";

const NOW = Date.parse("2026-09-03T18:00:00.000Z");

/** An Events Calendar `?ical=1` export, which names each post by its times. */
const ECP_EXPORT_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Example Con - ECPv6.17.3.1//NONSGML v1.0//EN",
  "X-WR-TIMEZONE:America/Chicago",
  "BEGIN:VEVENT",
  "UID:8154-1788454800-1788458400@examplecon.org",
  "DTSTART:20260903T200000Z",
  "DTEND:20260903T210000Z",
  "SUMMARY:Opening Ceremonies",
  "LOCATION:Main Stage",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

/** The same post as the REST expansion renders it. */
const ECP_REST_ICS = buildIcsFromEcpEvents([
  {
    id: 8154,
    title: "Opening Ceremonies",
    utc_start_date: "2026-09-03 20:00:00",
    utc_end_date: "2026-09-03 21:00:00",
    timezone: "America/Chicago",
    venue: { venue: "Main Stage" },
  },
]);

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
    catalogSlug: null,
    catalogRevision: null,
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
    title: "Panel",
    description: null,
    startTime: "2026-09-03T20:00:00.000Z",
    endTime: "2026-09-03T21:00:00.000Z",
    room: "Room A",
    location: "Main Hall",
    category: null,
    sourceUrl: null,
    isAgeRestricted: false,
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
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
        description: null,
        category: null,
        categories: [],
        ageRating: null,
        isAgeRestricted: false,
        contentWarning: false,
        isAllDay: false,
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
  vi.stubGlobal("__DEV__", true);
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
  catalogSchedule.mockResolvedValue({
    version: 1,
    conventionId: "catalog-con",
    slug: "sample-con",
    revision: 4,
    timezone: "America/Chicago",
    status: "complete",
    sessions: [
      {
        id: "panel-1",
        title: "Panel",
        description: "",
        room: "Room A",
        startsAt: "2026-09-03T15:00",
        endsAt: "2026-09-03T16:00",
        status: "scheduled",
      },
    ],
  });
  updateConvention.mockResolvedValue(undefined);
});

describe("hasScheduleSource", () => {
  // The convention screen's "Check for Changes" item and the refresh's first
  // gate read this one predicate. The menu used to ask for icalUrl alone, so a
  // catalog download, which has a catalogSlug and no icalUrl, had no pressed
  // check even though the refresh handles it.
  it("counts a catalog slug or a saved feed URL as a source", () => {
    expect(
      hasScheduleSource(
        convention({ icalUrl: null, catalogSlug: "sample-con" }),
      ),
    ).toBe(true);
    expect(
      hasScheduleSource(
        convention({
          icalUrl: "https://x.example/feed.ics",
          catalogSlug: null,
        }),
      ),
    ).toBe(true);
    expect(
      hasScheduleSource(convention({ icalUrl: null, catalogSlug: null })),
    ).toBe(false);
  });
});

describe("canCheckSchedule", () => {
  // The convention screen offers "Check for Changes" only where this says
  // yes. Asking for a source alone showed the item on an ended catalog
  // download, an archived convention and a feed imported with categories left
  // out. The refresh skips all three, so the press got no answer at all.
  it.each([
    ["has no schedule source", { icalUrl: null, catalogSlug: null }, true],
    [
      "is a catalog download that has ended",
      { icalUrl: null, catalogSlug: "sample-con", status: "ended" as const },
      true,
    ],
    ["is archived", { archivedAt: "2026-09-07T00:00:00.000Z" }, true],
    ["was imported with categories left out", {}, false],
  ])(
    "refuses a convention that %s, and so does a pressed refresh",
    async (_label, overrides, allCategories) => {
      storage.getScheduleAllCategories.mockResolvedValue(allCategories);
      const target = convention(overrides);

      expect(await canCheckSchedule(target)).toBe(false);
      expect(
        await refreshConventionSchedule(target, deps, {
          force: true,
          now: NOW,
        }),
      ).toEqual({ status: "skipped" });
      expect(fetchScheduleIcs).not.toHaveBeenCalled();
      expect(catalogSchedule).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a saved feed", {}],
    ["a catalog download", { icalUrl: null, catalogSlug: "sample-con" }],
  ])("accepts a current convention with %s", async (_label, overrides) => {
    expect(await canCheckSchedule(convention(overrides))).toBe(true);
  });

  // The menu has nothing to do with the automatic check's switch or its
  // interval: a press skips the interval, and works with the switch off.
  it("ignores the automatic-check setting and the interval", async () => {
    storage.getScheduleAutoCheck.mockResolvedValue(false);
    storage.getScheduleCheckedAt.mockResolvedValue(NOW - 60_000);

    expect(await canCheckSchedule(convention())).toBe(true);
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

  it("uses the saved convention zone only as a feed parse fallback", async () => {
    parseIcs
      .mockReturnValueOnce({ requiresTimeZone: true })
      .mockReturnValueOnce(parsedFeed());
    await refreshConventionSchedule(convention(), deps, {
      force: true,
      now: NOW,
    });
    expect(parseIcs).toHaveBeenNthCalledWith(1, "BEGIN:VCALENDAR");
    expect(parseIcs).toHaveBeenNthCalledWith(2, "BEGIN:VCALENDAR", {
      timeZone: "America/Chicago",
    });
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
  it("returns unchanged when the catalog revision has not advanced", async () => {
    const result = await refreshConventionSchedule(
      convention({
        icalUrl: null,
        catalogSlug: "sample-con",
        catalogRevision: 4,
      }),
      deps,
      { now: NOW },
    );

    expect(result).toEqual({ status: "unchanged", checkedAt: NOW });
    expect(catalogSchedule).toHaveBeenCalledWith("sample-con", undefined);
    expect(runScheduleImport).not.toHaveBeenCalled();
    expect(updateConvention).not.toHaveBeenCalled();
  });

  it("applies a newer catalog revision and updates the saved revision", async () => {
    catalogSchedule.mockResolvedValueOnce({
      version: 1,
      conventionId: "catalog-con",
      slug: "sample-con",
      revision: 5,
      timezone: "America/Chicago",
      status: "complete",
      sessions: [
        {
          id: "panel-1",
          title: "Panel",
          description: "",
          room: "Room B",
          startsAt: "2026-09-03T16:00",
          endsAt: "2026-09-03T17:00",
          status: "scheduled",
        },
      ],
    });

    const result = await refreshConventionSchedule(
      convention({
        icalUrl: null,
        catalogSlug: "sample-con",
        catalogRevision: 4,
      }),
      deps,
      { now: NOW },
    );

    expect(result).toEqual({
      status: "applied",
      checkedAt: NOW,
      summary: {
        moved: 1,
        gone: 0,
        savedMoved: 1,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
    expect(runScheduleImport).toHaveBeenCalledWith(
      expect.objectContaining({
        conventionId: "con-1",
        sourceSnapshot: expect.objectContaining({ authoritative: true }),
      }),
    );
    expect(updateConvention).toHaveBeenCalledWith("con-1", {
      catalogRevision: 5,
      timeZone: "America/Chicago",
    });
    expect(publishWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.refreshCaches).toHaveBeenCalledWith("con-1");
  });

  it("reports an unchanged feed and stamps the check", async () => {
    const result = await refreshConventionSchedule(convention(), deps, {
      now: NOW,
    });

    expect(result).toEqual({ status: "unchanged", checkedAt: NOW });
    expect(storage.setScheduleCheckedAt).toHaveBeenCalledWith("con-1", NOW);
    expect(runScheduleImport).not.toHaveBeenCalled();
  });

  it("applies panels the feed has gained, quietly", async () => {
    // Nothing stored moved or went, so the summary has nothing to report. The
    // new panel still has to reach the schedule rather than wait for some
    // unrelated panel to move.
    parseIcs.mockReturnValue(
      parsedFeed({
        events: [
          parsedFeed().events[0],
          {
            ...parsedFeed().events[0],
            sourceUid: "panel-2",
            title: "New panel",
            startTime: new Date("2026-09-03T22:00:00.000Z"),
            endTime: new Date("2026-09-03T23:00:00.000Z"),
          },
        ],
      }),
    );

    const result = await refreshConventionSchedule(convention(), deps, {
      now: NOW,
    });

    // `applied` with nothing saved to report: the caches refresh, no notice.
    expect(result).toEqual({
      status: "applied",
      checkedAt: NOW,
      summary: {
        moved: 0,
        gone: 0,
        savedMoved: 0,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
    expect(runScheduleImport).toHaveBeenCalledTimes(1);
    expect(runScheduleImport).toHaveBeenCalledWith(
      expect.objectContaining({
        conventionId: "con-1",
        parsedEvents: expect.arrayContaining([
          expect.objectContaining({ sourceUid: "panel-2" }),
        ]),
      }),
    );
    expect(storage.setScheduleCheckedAt).toHaveBeenCalledWith("con-1", NOW);
    expect(publishWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.refreshCaches).toHaveBeenCalledWith("con-1");
  });

  it.each([
    ["a corrected title", { title: "Panel: Fursuit Basics" }],
    ["a new description", { description: "Bring a water bottle." }],
    ["a new content warning", { contentWarning: true }],
  ])("applies %s quietly", async (_label, edit) => {
    // Time and place are all the notice counts, so wording and label fixes
    // are never news — but they are still the convention's current schedule.
    parseIcs.mockReturnValue(
      parsedFeed({ events: [{ ...parsedFeed().events[0], ...edit }] }),
    );

    const result = await refreshConventionSchedule(convention(), deps, {
      now: NOW,
    });

    expect(result).toEqual({
      status: "applied",
      checkedAt: NOW,
      summary: {
        moved: 0,
        gone: 0,
        savedMoved: 0,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
    expect(runScheduleImport).toHaveBeenCalledTimes(1);
    expect(deps.refreshCaches).toHaveBeenCalledWith("con-1");
  });

  it("keeps applying a feed whose rows an earlier build filed under alarm UIDs", async () => {
    // Apple exports give each VALARM its own UID, which earlier builds stored
    // in place of the event's. Without the previous identity nothing overlaps
    // and every later check comes back untrusted, so the feed stops updating.
    getByConventionId.mockResolvedValue([
      storedRow({ sourceUid: "alarm-uid-1" }),
    ]);
    parseIcs.mockReturnValue(
      parsedFeed({
        events: [
          {
            ...parsedFeed().events[0],
            sourceUid: "event-uid-1",
            previousSourceUid: "alarm-uid-1",
          },
        ],
      }),
    );

    const result = await refreshConventionSchedule(convention(), deps, {
      now: NOW,
    });

    // Nothing moved, so nothing to report, but the write runs and re-files
    // the saved row under the event's own UID.
    expect(result).toEqual({
      status: "applied",
      checkedAt: NOW,
      summary: {
        moved: 0,
        gone: 0,
        savedMoved: 0,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
    });
    expect(runScheduleImport).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSnapshot: expect.objectContaining({
          activeOccurrences: [
            expect.objectContaining({
              sourceUid: "event-uid-1",
              previousSourceUid: "alarm-uid-1",
            }),
          ],
        }),
      }),
    );
  });

  it.each([
    ["the normalized export", normalizeEcpUids(ECP_EXPORT_ICS)],
    ["the REST expansion", ECP_REST_ICS],
  ])(
    "keeps applying an Events Calendar feed stored under export UIDs when it reads %s",
    async (_body, ics) => {
      // Earlier builds stored the export's own UIDs whenever the REST expansion
      // did not win. Both bodies now name each post `<post id>@conpaws.ecp`, so
      // without the export UID as its previous identity nothing overlaps and
      // every check, pressed or not, comes back untrusted.
      const { parseIcs: realParseIcs } =
        await vi.importActual<typeof import("@/lib/ical-parser")>(
          "@/lib/ical-parser",
        );
      parseIcs.mockImplementation(realParseIcs);
      getByConventionId.mockResolvedValue(
        realParseIcs(ECP_EXPORT_ICS).events.map((event) =>
          storedRow({
            sourceUid: event.sourceUid,
            title: event.title,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime?.toISOString() ?? null,
            room: event.room,
            location: event.location,
          }),
        ),
      );
      fetchScheduleIcs.mockResolvedValue({ icsContent: ics });

      const result = await refreshConventionSchedule(convention(), deps, {
        now: NOW,
      });

      expect(result).toEqual({
        status: "applied",
        checkedAt: NOW,
        summary: {
          moved: 0,
          gone: 0,
          savedMoved: 0,
          savedGone: 0,
          nowDropIn: 0,
          savedNowDropIn: 0,
        },
      });
      expect(runScheduleImport).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceSnapshot: expect.objectContaining({
            activeOccurrences: [
              expect.objectContaining({ sourceUid: "8154@conpaws.ecp" }),
            ],
          }),
        }),
      );
    },
  );

  it("tells the user a saved all-day event is now a drop-in, not that it moved", async () => {
    // Earlier builds stored all-day events with no end. The unchanged feed now
    // reads as the whole day, which is a drop-in that needs a visit to stay in
    // the plan, so that is what the notice says.
    const allDay = {
      sourceUid: "costume-day",
      startTime: "2026-09-05T05:00:00.000Z",
      room: "Room A",
      location: "Main Hall",
    };
    getByConventionId.mockResolvedValue([
      storedRow({ ...allDay, endTime: null }),
    ]);
    parseIcs.mockReturnValue(
      parsedFeed({
        events: [
          {
            ...parsedFeed().events[0],
            ...allDay,
            startTime: new Date(allDay.startTime),
            endTime: new Date("2026-09-06T05:00:00.000Z"),
            isAllDay: true,
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
      summary: {
        moved: 0,
        gone: 0,
        savedMoved: 0,
        savedGone: 0,
        nowDropIn: 1,
        savedNowDropIn: 1,
      },
    });
    // The end time is still written, so the row files like a fresh import.
    expect(runScheduleImport).toHaveBeenCalledTimes(1);
  });

  it("does not pour a feed into a convention that holds none of its rows", async () => {
    // With nothing to overlap there is no evidence this is the right feed,
    // the same caution the change summary applies before it trusts one.
    getByConventionId.mockResolvedValue([
      storedRow({ id: "hand-added", sourceUid: null }),
    ]);

    expect(
      await refreshConventionSchedule(convention(), deps, { now: NOW }),
    ).toEqual({ status: "unchanged", checkedAt: NOW });
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
      summary: {
        moved: 1,
        gone: 0,
        savedMoved: 1,
        savedGone: 0,
        nowDropIn: 0,
        savedNowDropIn: 0,
      },
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
