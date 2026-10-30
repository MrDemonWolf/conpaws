import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewConvention, NewConventionEvent } from "@/db/schema";
import {
  BLANK_PREVIEW_CONVENTION_ID,
  PREVIEW_CONVENTION_ID,
} from "@/fixtures/conpaws-preview";
import {
  addPreviewConventions,
  getPreviewConventionFixtures,
  resetPreviewConventions,
} from "./preview-convention";

const database = vi.hoisted(() => {
  const state = {
    deleteRuns: 0,
    inserts: [] as unknown[],
    conventions: new Map<string, NewConvention>(),
    events: new Map<string, NewConventionEvent>(),
  };

  function insertRows(value: unknown) {
    state.inserts.push(value);
    if (Array.isArray(value)) {
      for (const event of value as NewConventionEvent[]) {
        state.events.set(event.id, { ...event });
      }
    } else {
      const convention = value as NewConvention;
      state.conventions.set(convention.id, { ...convention });
    }
  }

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
        run: vi.fn(() => insertRows(value)),
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => ({
            get: vi.fn(() => {
              const convention = value as NewConvention;
              if (state.conventions.has(convention.id)) return undefined;
              insertRows(value);
              return { id: convention.id };
            }),
          })),
        })),
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

const notificationMocks = vi.hoisted(() => ({
  cancelConventionReminders: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/db", () => ({
  db: { transaction: database.transaction },
}));

vi.mock("@/services/notifications", () => notificationMocks);

describe("ConPaws Preview Con", () => {
  beforeEach(() => {
    database.state.deleteRuns = 0;
    database.state.inserts.length = 0;
    database.state.conventions.clear();
    database.state.events.clear();
    database.transaction.mockClear();
    notificationMocks.cancelConventionReminders.mockClear();
  });

  it.each([
    [false, "preview"],
    [true, "development"],
  ])("adds both samples in enabled builds (%s, %s)", async (isDev, variant) => {
    await expect(addPreviewConventions(isDev, variant)).resolves.toBe(
      PREVIEW_CONVENTION_ID,
    );

    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect([...database.state.conventions.keys()]).toEqual([
      PREVIEW_CONVENTION_ID,
      BLANK_PREVIEW_CONVENTION_ID,
    ]);
    expect(database.state.events.size).toBe(200);
    const events = [...database.state.events.values()];
    expect(events[0]?.isInSchedule).toBe(true);
    expect(events[1]?.isInSchedule).toBe(true);
    expect(events.every((event) => event.reminderMinutes === null)).toBe(true);
    expect(database.state.deleteRuns).toBe(0);
    expect(notificationMocks.cancelConventionReminders).not.toHaveBeenCalled();
  });

  it.each([
    [false, "production"],
    [true, "production"],
    [false, "development"],
    [true, undefined],
  ])(
    "does not write samples in disabled builds (%s, %s)",
    async (isDev, variant) => {
      await expect(addPreviewConventions(isDev, variant)).resolves.toBeNull();
      expect(database.transaction).not.toHaveBeenCalled();
      expect(database.state.inserts).toEqual([]);
      expect(
        notificationMocks.cancelConventionReminders,
      ).not.toHaveBeenCalled();
    },
  );

  it("reopens existing samples without overwriting edits or unrelated conventions", async () => {
    await addPreviewConventions(false, "preview");
    const convention = database.state.conventions.get(PREVIEW_CONVENTION_ID);
    const event = [...database.state.events.values()][0];
    if (!convention || !event) throw new Error("Samples were not inserted");
    convention.name = "My edited sample";
    event.title = "My edited session";
    event.isInSchedule = false;
    event.reminderMinutes = 5;
    database.state.conventions.set("my-convention", {
      ...convention,
      id: "my-convention",
      name: "My own convention",
    });
    database.state.events.set("my-event", {
      ...event,
      id: "my-event",
      conventionId: "my-convention",
    });
    const conventionsBefore = structuredClone(database.state.conventions);
    const eventsBefore = structuredClone(database.state.events);
    const insertCount = database.state.inserts.length;

    await expect(addPreviewConventions(false, "preview")).resolves.toBe(
      PREVIEW_CONVENTION_ID,
    );

    expect(database.state.conventions).toEqual(conventionsBefore);
    expect(database.state.events).toEqual(eventsBefore);
    expect(database.state.inserts).toHaveLength(insertCount);
    expect(database.state.deleteRuns).toBe(0);
    expect(notificationMocks.cancelConventionReminders).not.toHaveBeenCalled();
  });

  it("adds a missing blank sample without reinserting the existing sample events", async () => {
    await addPreviewConventions(false, "preview");
    database.state.conventions.delete(BLANK_PREVIEW_CONVENTION_ID);
    const eventsBefore = structuredClone(database.state.events);
    const insertCount = database.state.inserts.length;

    await addPreviewConventions(false, "preview");

    expect(database.state.conventions.has(BLANK_PREVIEW_CONVENTION_ID)).toBe(
      true,
    );
    expect(database.state.events).toEqual(eventsBefore);
    expect(database.state.inserts).toHaveLength(insertCount + 1);
    expect(database.state.deleteRuns).toBe(0);
    expect(notificationMocks.cancelConventionReminders).not.toHaveBeenCalled();
  });

  it("propagates a transaction failure without cancelling reminders", async () => {
    database.transaction.mockImplementationOnce(() => {
      throw new Error("Storage unavailable");
    });

    await expect(addPreviewConventions(false, "preview")).rejects.toThrow(
      "Storage unavailable",
    );
    expect(database.state.inserts).toEqual([]);
    expect(notificationMocks.cancelConventionReminders).not.toHaveBeenCalled();
  });

  it("is available in owner preview builds and unavailable in production", async () => {
    expect(getPreviewConventionFixtures(false, "preview")).not.toBeNull();
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

  it("cancels local reminders for every preview event after the rows are replaced", async () => {
    const fixtures = getPreviewConventionFixtures(true, "development");
    const eventIds = fixtures?.flatMap((fixture) =>
      fixture.events.map((event) => event.id),
    );

    await resetPreviewConventions(true, "development");

    expect(eventIds).toHaveLength(200);
    expect(notificationMocks.cancelConventionReminders).toHaveBeenCalledWith(
      eventIds,
    );
    expect(
      notificationMocks.cancelConventionReminders.mock.invocationCallOrder[0],
    ).toBeGreaterThan(database.transaction.mock.invocationCallOrder[0] ?? 0);
  });
});
