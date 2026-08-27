import { describe, expect, it, vi } from "vitest";
import {
  type BackupEnvelope,
  chunkRows,
  MAX_BACKUP_ROWS,
  planDataImport,
  validateImportFile,
} from "./data-import";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("expo-document-picker", () => ({}));
vi.mock("expo-file-system", () => ({ File: class {} }));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));

const NOW = "2026-08-27T00:00:00.000Z";

function conventionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "convention-export-id",
    name: "Test Con",
    startDate: "2026-08-21",
    endDate: "2026-08-23",
    timeZone: "America/Chicago",
    location: null,
    archivedAt: null,
    icalUrl: "https://testcon.sched.com",
    status: "upcoming",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
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
    ageRating: null,
    contentWarning: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function envelope(
  conventionRows: unknown[],
  eventRows: unknown[],
): BackupEnvelope {
  return { conventions: conventionRows, events: eventRows };
}

function file(data: unknown) {
  return { version: 1, exportedAt: NOW, app: "ConPaws", data };
}

describe("backup envelope validation", () => {
  it("names each envelope failure with its own code", () => {
    expect(validateImportFile(null)).toEqual({
      ok: false,
      code: "not-an-object",
    });
    expect(validateImportFile([])).toEqual({
      ok: false,
      code: "not-an-object",
    });
    expect(validateImportFile({ ...file({}), version: 2 })).toEqual({
      ok: false,
      code: "unsupported-version",
    });
    expect(validateImportFile({ ...file({}), app: "NotConPaws" })).toEqual({
      ok: false,
      code: "not-conpaws",
    });
    expect(validateImportFile({ version: 1, app: "ConPaws" })).toEqual({
      ok: false,
      code: "missing-data",
    });
    expect(validateImportFile(file({ conventions: {}, events: [] }))).toEqual({
      ok: false,
      code: "malformed-data",
    });
  });

  it("rejects a file whose combined row count is past the ceiling", () => {
    const outcome = validateImportFile(
      file({
        conventions: new Array(MAX_BACKUP_ROWS).fill(conventionRow()),
        events: new Array(2).fill(eventRow()),
      }),
    );

    expect(outcome).toEqual({
      ok: false,
      code: "too-many-rows",
      detail: { rows: MAX_BACKUP_ROWS + 2, limit: MAX_BACKUP_ROWS },
    });
  });

  it("returns the counts a confirmation prompt needs", () => {
    const outcome = validateImportFile(
      file({ conventions: [conventionRow()], events: [eventRow()] }),
    );

    expect(outcome).toMatchObject({
      ok: true,
      conventionCount: 1,
      eventCount: 1,
    });
  });
});

describe("backup import planning", () => {
  it("preserves IDs and makes a second identical import a no-op", () => {
    const input = envelope([conventionRow()], [eventRow()]);
    const first = planDataImport(input, new Set(), new Set(), NOW);

    expect(first.result).toEqual({
      ok: true,
      conventionsAdded: 1,
      eventsAdded: 1,
      skipped: 0,
      reasons: { duplicate: 0, orphan: 0, malformed: 0, "invalid-date": 0 },
    });
    expect(first.conventions[0].id).toBe("convention-export-id");
    expect(first.events[0]).toMatchObject({
      id: "event-export-id",
      conventionId: "convention-export-id",
      reminderMinutes: null,
    });

    const second = planDataImport(
      input,
      new Set(first.conventions.map((convention) => convention.id)),
      new Set(first.events.map((event) => event.id)),
      NOW,
    );

    expect(second.conventions).toEqual([]);
    expect(second.events).toEqual([]);
    expect(second.result.skipped).toBe(2);
    expect(second.result.reasons.duplicate).toBe(2);
  });

  it("skips the event whose startTime cannot be parsed and keeps the rest", () => {
    const plan = planDataImport(
      envelope(
        [conventionRow()],
        [
          eventRow({ id: "broken", startTime: "2026-13-45" }),
          eventRow({ id: "fine" }),
        ],
      ),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.events.map((event) => event.id)).toEqual(["fine"]);
    expect(plan.result.reasons["invalid-date"]).toBe(1);
    expect(plan.result.eventsAdded).toBe(1);
  });

  it("skips a row whose date is absurd rather than merely unparseable", () => {
    const plan = planDataImport(
      envelope(
        [conventionRow()],
        [
          eventRow({ id: "ancient", startTime: "1400-01-01T00:00:00.000Z" }),
          eventRow({ id: "far-future", startTime: "+275760-09-13T00:00:00Z" }),
          eventRow({ id: "negative", startTime: "-000001-01-01T00:00:00Z" }),
        ],
      ),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.events).toEqual([]);
    expect(plan.result.reasons["invalid-date"]).toBe(3);
  });

  it("skips an event whose endTime is present but unparseable", () => {
    const plan = planDataImport(
      envelope([conventionRow()], [eventRow({ endTime: "TBA" })]),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.events).toEqual([]);
    expect(plan.result.reasons["invalid-date"]).toBe(1);
  });

  it("rejects type confusion in either direction", () => {
    const plan = planDataImport(
      envelope(
        [conventionRow()],
        [
          // A number where the column is TEXT.
          eventRow({ id: "numeric-title", title: 42 }),
          // An object where the column is TEXT.
          eventRow({ id: "object-room", room: { toString: "gotcha" } }),
          // A string where the column is INTEGER.
          eventRow({ id: "string-flag", isInSchedule: "yes" }),
          // Not a row at all.
          "just a string",
          null,
          ["nested"],
        ],
      ),
      new Set(),
      new Set(),
      NOW,
    );

    // isInSchedule is coerced rather than rejected: it is a flag with a
    // default, not an identity, so a bad value falls back to false.
    expect(plan.events.map((event) => event.id)).toEqual(["string-flag"]);
    expect(plan.events[0].isInSchedule).toBe(false);
    expect(plan.result.reasons.malformed).toBe(5);
  });

  it("keeps a prototype-polluting key out of the inserted row", () => {
    const hostile = JSON.parse(
      `{"__proto__":{"polluted":true},"constructor":{"x":1},"id":"evil","conventionId":"convention-export-id","title":"Panel","startTime":"2026-08-21T15:00:00.000Z","endTime":null,"description":null,"location":null,"room":null,"category":null,"type":null,"isInSchedule":false,"reminderMinutes":null,"sourceUid":null,"sourceUrl":null,"isAgeRestricted":false,"ageRating":null,"contentWarning":false,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}`,
    );

    const plan = planDataImport(
      envelope([conventionRow()], [hostile]),
      new Set(),
      new Set(),
      NOW,
    );

    const row = plan.events[0];
    expect(row.id).toBe("evil");
    expect(Object.keys(row)).not.toContain("__proto__");
    expect(Object.keys(row)).not.toContain("constructor");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("drops an out-of-set status or ageRating back to the schema default", () => {
    const plan = planDataImport(
      envelope(
        [conventionRow({ status: "cancelled" })],
        [eventRow({ ageRating: "18-and-up" })],
      ),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.conventions[0].status).toBe("upcoming");
    expect(plan.events[0].ageRating).toBeNull();
  });

  it("rejects a field longer than the per-field ceiling", () => {
    const plan = planDataImport(
      envelope(
        [conventionRow()],
        [
          eventRow({ id: "long-title", title: "x".repeat(1_001) }),
          eventRow({ id: "long-desc", description: "x".repeat(50_001) }),
        ],
      ),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.events).toEqual([]);
    expect(plan.result.reasons.malformed).toBe(2);
  });

  it("counts an event whose convention is nowhere as an orphan", () => {
    const plan = planDataImport(
      envelope([], [eventRow()]),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.events).toEqual([]);
    expect(plan.result.reasons.orphan).toBe(1);
    expect(plan.result.reasons.malformed).toBe(0);
  });

  it("falls back to now for a missing or unusable timestamp", () => {
    const plan = planDataImport(
      envelope(
        [conventionRow({ createdAt: undefined, updatedAt: "not a date" })],
        [],
      ),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.conventions[0].createdAt).toBe(NOW);
    expect(plan.conventions[0].updatedAt).toBe(NOW);
  });

  it("drops a time zone the device cannot resolve", () => {
    const plan = planDataImport(
      envelope([conventionRow({ timeZone: "Mars/Olympus_Mons" })], []),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.conventions[0].timeZone).toBeNull();
  });
});

describe("insert batching", () => {
  it("keeps every chunk under the bound-parameter ceiling", () => {
    const rows = new Array(200).fill(0).map((_, i) => i);
    const chunks = chunkRows(rows, 19);

    expect(chunks.flat()).toEqual(rows);
    for (const chunk of chunks) {
      expect(chunk.length * 19).toBeLessThanOrEqual(900);
    }
  });

  it("returns nothing for no rows", () => {
    expect(chunkRows([], 19)).toEqual([]);
  });
});
