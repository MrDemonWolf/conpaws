import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Convention } from "../schema";
import { create } from "./conventions";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { insert: vi.fn(), select: vi.fn() },
}));

vi.mock("../index", () => ({ db: mockDb }));

function storedConvention(overrides: Partial<Convention> = {}): Convention {
  return {
    id: "conv_1",
    name: "TestCon",
    status: "upcoming",
    location: null,
    startDate: "2026-06-12",
    endDate: "2026-06-14",
    timeZone: "America/Chicago",
    icalUrl: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Stands in for `db.select().from(...).where(...)`, which resolves to rows. */
function mockSelectRows(rows: Convention[]): void {
  mockDb.select.mockReturnValue({
    from: () => ({ where: () => Promise.resolve(rows) }),
  });
}

describe("conventions.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("returns the row it just inserted", async () => {
    const row = storedConvention();
    mockSelectRows([row]);

    await expect(
      create({
        name: "TestCon",
        startDate: "2026-06-12",
        endDate: "2026-06-14",
        timeZone: "America/Chicago",
      }),
    ).resolves.toEqual(row);
  });

  it("throws when the inserted row cannot be read back", async () => {
    mockSelectRows([]);

    await expect(
      create({
        name: "TestCon",
        startDate: "2026-06-12",
        endDate: "2026-06-14",
        timeZone: "America/Chicago",
      }),
    ).rejects.toThrow(/could not be read back after insert/);
  });
});
