import { beforeEach, describe, expect, it, vi } from "vitest";

const documentPicker = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
}));

/** Stands in for the one `File(uri).text()` call `pickBackupFile` makes. */
const readFileText = vi.hoisted(() => vi.fn(async (_uri: string) => ""));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("expo-document-picker", () => documentPicker);
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(readonly uri: string) {}
    text() {
      return readFileText(this.uri);
    }
  },
}));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));

import {
  type BackupEnvelope,
  chunkRows,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_ROWS,
  pickBackupFile,
  planDataImport,
  validateImportFile,
} from "./data-import";

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

  it("accepts a file sitting exactly on the row ceiling", () => {
    // The ceiling is a limit, not a forbidden value: an export of exactly this
    // size has to restore, or the app can produce a backup it cannot read.
    const outcome = validateImportFile(
      file({
        conventions: new Array(1).fill(conventionRow()),
        events: new Array(MAX_BACKUP_ROWS - 1).fill(eventRow()),
      }),
    );

    expect(outcome).toMatchObject({
      ok: true,
      eventCount: MAX_BACKUP_ROWS - 1,
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

describe("convention row validation", () => {
  function planOne(overrides: Record<string, unknown> | unknown) {
    const candidate =
      typeof overrides === "object" &&
      overrides !== null &&
      !Array.isArray(overrides)
        ? conventionRow(overrides as Record<string, unknown>)
        : overrides;
    return planDataImport(envelope([candidate], []), new Set(), new Set(), NOW);
  }

  it("needs an id and a name that survive trimming", () => {
    for (const broken of [
      { id: "" },
      { id: "   " },
      { id: 7 },
      { name: "" },
      { name: "\t\n " },
      { name: null },
    ]) {
      const plan = planOne(broken);
      expect(plan.conventions).toEqual([]);
      expect(plan.result.reasons.malformed).toBe(1);
    }
  });

  it("trims the id and name it does accept", () => {
    const plan = planOne({ id: "  con-1  ", name: "  Test Con  " });

    expect(plan.conventions[0]).toMatchObject({
      id: "con-1",
      name: "Test Con",
    });
  });

  it("rejects anything that is not a row object", () => {
    for (const candidate of ["a string", 42, null, true, ["nested"]]) {
      const plan = planOne(candidate);
      expect(plan.conventions).toEqual([]);
      expect(plan.result.reasons.malformed).toBe(1);
    }
  });

  it("separates a missing date from an unusable one", () => {
    expect(planOne({ startDate: undefined }).result.reasons.malformed).toBe(1);
    expect(planOne({ endDate: null }).result.reasons.malformed).toBe(1);

    for (const broken of [
      { startDate: "not a date" },
      { endDate: "2026-13-45" },
      { startDate: "1400-01-01" },
      { endDate: "+275760-09-13T00:00:00Z" },
    ]) {
      const plan = planOne(broken);
      expect(plan.conventions).toEqual([]);
      expect(plan.result.reasons["invalid-date"]).toBe(1);
    }
  });

  it("takes archivedAt as null, a real instant, or nothing else", () => {
    expect(planOne({ archivedAt: null }).conventions[0].archivedAt).toBeNull();
    expect(
      planOne({ archivedAt: undefined }).conventions[0].archivedAt,
    ).toBeNull();
    expect(
      planOne({ archivedAt: "2026-08-24T00:00:00.000Z" }).conventions[0]
        .archivedAt,
    ).toBe("2026-08-24T00:00:00.000Z");

    // A number is the wrong shape entirely; a string that is not an instant is
    // the right shape carrying a value nothing can format.
    expect(planOne({ archivedAt: 0 }).result.reasons.malformed).toBe(1);
    expect(
      planOne({ archivedAt: "someday" }).result.reasons["invalid-date"],
    ).toBe(1);
  });

  it("rejects a non-string where an optional string belongs", () => {
    for (const broken of [
      { location: 12345 },
      { icalUrl: { href: "https://example.com" } },
      { location: ["Indianapolis"] },
    ]) {
      const plan = planOne(broken);
      expect(plan.conventions).toEqual([]);
      expect(plan.result.reasons.malformed).toBe(1);
    }

    // Absent and explicitly null both mean "no value", and both are fine.
    expect(planOne({ location: null }).conventions[0].location).toBeNull();
    expect(planOne({ icalUrl: undefined }).conventions[0].icalUrl).toBeNull();
  });

  it("rejects a name longer than the per-field ceiling", () => {
    expect(planOne({ name: "x".repeat(1_001) }).result.reasons.malformed).toBe(
      1,
    );
    expect(planOne({ name: "x".repeat(1_000) }).conventions).toHaveLength(1);
  });

  it("keeps a prototype-polluting key out of the inserted convention", () => {
    const hostile = JSON.parse(
      `{"__proto__":{"pollutedConvention":true},"constructor":{"x":1},"id":"evil-con","name":"Evil Con","startDate":"2026-08-21","endDate":"2026-08-23","status":"upcoming","timeZone":"America/Chicago","location":null,"archivedAt":null,"icalUrl":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}`,
    );

    const plan = planDataImport(
      envelope([hostile], []),
      new Set(),
      new Set(),
      NOW,
    );

    expect(plan.conventions[0].id).toBe("evil-con");
    expect(Object.keys(plan.conventions[0])).not.toContain("__proto__");
    expect(({} as Record<string, unknown>).pollutedConvention).toBeUndefined();
  });
});

describe("picking a backup file", () => {
  function picked(uri = "file:///backup.json", size?: number) {
    documentPicker.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri, size, name: "backup.json", mimeType: "application/json" },
      ],
    });
  }

  beforeEach(() => {
    documentPicker.getDocumentAsync.mockReset();
    readFileText.mockReset();
  });

  it("treats a closed picker as its own outcome, not a failure", async () => {
    documentPicker.getDocumentAsync.mockResolvedValueOnce({
      canceled: true,
      assets: null,
    });

    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "cancelled",
    });
    expect(readFileText).not.toHaveBeenCalled();
  });

  it("refuses an oversized file without reading it into memory", async () => {
    picked("file:///huge.json", MAX_BACKUP_BYTES + 1);

    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "file-too-large",
      detail: { bytes: MAX_BACKUP_BYTES + 1, limit: MAX_BACKUP_BYTES },
    });
    // The whole point of the size gate is that the read never happens.
    expect(readFileText).not.toHaveBeenCalled();
  });

  it("still refuses oversized content when the picker reports no size", async () => {
    const content = "x".repeat(MAX_BACKUP_BYTES + 1);
    picked();
    readFileText.mockResolvedValueOnce(content);

    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "file-too-large",
      detail: { bytes: content.length, limit: MAX_BACKUP_BYTES },
    });
  });

  it("reads a file exactly on the byte ceiling", async () => {
    const payload = JSON.stringify(
      file({ conventions: [conventionRow()], events: [] }),
    );
    picked("file:///backup.json", MAX_BACKUP_BYTES);
    readFileText.mockResolvedValueOnce(payload);

    await expect(pickBackupFile()).resolves.toMatchObject({
      ok: true,
      conventionCount: 1,
    });
  });

  it("reports a file it cannot read rather than throwing", async () => {
    picked();
    readFileText.mockRejectedValueOnce(new Error("EACCES"));

    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "unreadable",
    });
  });

  it("reports a picker that fails outright, and a pick with no asset", async () => {
    documentPicker.getDocumentAsync.mockRejectedValueOnce(
      new Error("picker crashed"),
    );
    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "unreadable",
    });

    documentPicker.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [],
    });
    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "unreadable",
    });
  });

  it("tells a file that is not JSON from one that is not a backup", async () => {
    picked();
    readFileText.mockResolvedValueOnce("<html>not json</html>");
    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "invalid-json",
    });

    picked();
    readFileText.mockResolvedValueOnce(
      JSON.stringify({ version: 1, app: "SomethingElse", data: {} }),
    );
    await expect(pickBackupFile()).resolves.toEqual({
      ok: false,
      code: "not-conpaws",
    });
  });

  it("carries an export straight back to a preview", async () => {
    // The literal here is shaped like `ExportPayload` from data-export.ts, so
    // this is the round trip a user actually performs: export, then restore.
    const payload = file({
      conventions: [conventionRow()],
      events: [eventRow(), eventRow({ id: "second-event" })],
    });
    picked("file:///conpaws-export-2026-08-27.json", 2_048);
    readFileText.mockResolvedValueOnce(JSON.stringify(payload, null, 2));

    const outcome = await pickBackupFile();

    expect(outcome).toMatchObject({
      ok: true,
      conventionCount: 1,
      eventCount: 2,
    });
    expect(readFileText).toHaveBeenCalledWith(
      "file:///conpaws-export-2026-08-27.json",
    );

    if (!outcome.ok) throw new Error("expected a preview");
    const plan = planDataImport(outcome.envelope, new Set(), new Set(), NOW);
    expect(plan.result).toMatchObject({
      conventionsAdded: 1,
      eventsAdded: 2,
      skipped: 0,
    });
  });
});
