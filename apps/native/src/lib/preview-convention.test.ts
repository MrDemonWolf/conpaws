import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewConventionEvent } from "@/db/schema";
import {
  getPreviewConventionFixtures,
  resetPreviewConventions,
} from "./preview-convention";

const database = vi.hoisted(() => {
  const state = { deleteRuns: 0, inserts: [] as unknown[] };
  const tx = {
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: vi.fn(() => {
          state.deleteRuns += 1;
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: unknown) => ({
        run: vi.fn(() => {
          state.inserts.push(value);
        }),
      })),
    })),
  };

  return {
    state,
    transaction: vi.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
});

vi.mock("@/db", () => ({
  db: { transaction: database.transaction },
}));

describe("ConPaws Preview Con", () => {
  beforeEach(() => {
    database.state.deleteRuns = 0;
    database.state.inserts.length = 0;
    database.transaction.mockClear();
  });

  it("is unavailable outside a development bundle running dev JavaScript", async () => {
    expect(getPreviewConventionFixtures(true, "preview")).toBeNull();
    expect(getPreviewConventionFixtures(true, "production")).toBeNull();
    expect(getPreviewConventionFixtures(false, "development")).toBeNull();
    await expect(
      resetPreviewConventions(false, "development"),
    ).resolves.toBeNull();
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("replaces the same dense and blank fixtures on every reset", async () => {
    const fixtures = getPreviewConventionFixtures(true, "development");
    expect(fixtures?.[0].events).toHaveLength(200);
    expect(fixtures?.[1].events).toHaveLength(0);

    await resetPreviewConventions(true, "development");
    await resetPreviewConventions(true, "development");

    const firstEvents = database.state.inserts[1] as NewConventionEvent[];
    const secondEvents = database.state.inserts[4] as NewConventionEvent[];

    expect(database.state.deleteRuns).toBe(4);
    expect(database.state.inserts).toHaveLength(6);
    expect(firstEvents).toHaveLength(200);
    expect(secondEvents).toEqual(firstEvents);
    expect(new Set(firstEvents.map((event) => event.id)).size).toBe(200);
    expect(firstEvents[0]?.startTime).toBe(firstEvents[1]?.startTime);
    expect(firstEvents[0]?.isInSchedule).toBe(true);
    expect(firstEvents[1]?.isInSchedule).toBe(true);
    expect(firstEvents[0]?.reminderMinutes).toBe(60);
    expect(firstEvents[1]?.reminderMinutes).toBe(15);
  });
});
