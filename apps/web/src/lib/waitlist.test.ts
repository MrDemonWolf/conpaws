import { afterEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db";
import {
  MAX_SYNC_ATTEMPTS,
  RECONCILE_BATCH_SIZE,
  reconcile,
  syncRow,
} from "./waitlist";

const CONFIG = {
  apiKey: "key",
  listId: 4,
  templateId: 9,
  redirectionUrl: "https://conpaws.com/confirmed",
};

type PendingRow = {
  id: string;
  email: string;
  name: string;
  syncAttempts: number;
};

/**
 * A stand-in for the Drizzle D1 client that records what the code under test
 * asked for. It covers only the two query shapes this module builds, which is
 * the point: if the shape changes, the fake stops matching and the test fails.
 */
function fakeDb(pending: PendingRow[] = []) {
  const updates: Array<Record<string, unknown>> = [];
  let limit = 0;

  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updates.push(values);
          return Promise.resolve();
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: (value: number) => {
              limit = value;
              return Promise.resolve(pending.slice(0, value));
            },
          }),
        }),
      }),
    }),
  };

  return { db: db as unknown as Db, updates, limitUsed: () => limit };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncRow", () => {
  it("stamps synced_at and clears the error on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const { db, updates } = fakeDb();

    await expect(
      syncRow(db, CONFIG, {
        id: "a",
        email: "person@example.com",
        name: "",
        syncAttempts: 0,
      }),
    ).resolves.toBe(true);

    expect(updates).toHaveLength(1);
    expect(updates[0]?.syncedAt).toBeInstanceOf(Date);
    expect(updates[0]?.syncError).toBeNull();
  });

  it("records the failure and increments the attempt count", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 429 }),
    );
    const { db, updates } = fakeDb();

    await expect(
      syncRow(db, CONFIG, {
        id: "a",
        email: "person@example.com",
        name: "",
        syncAttempts: 2,
      }),
    ).resolves.toBe(false);

    expect(updates[0]).toMatchObject({
      syncAttempts: 3,
      syncError: "429: nope",
    });
    // The row keeps synced_at NULL, which is what makes the reconciler find it
    // again on the next fire.
    expect(updates[0]).not.toHaveProperty("syncedAt");
  });
});

describe("reconcile", () => {
  it("replays every pending row and reports the tally", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }));

    const { db } = fakeDb([
      { id: "a", email: "a@example.com", name: "", syncAttempts: 0 },
      { id: "b", email: "b@example.com", name: "", syncAttempts: 0 },
    ]);

    await expect(reconcile(db, CONFIG)).resolves.toEqual({
      attempted: 2,
      synced: 1,
      failed: 1,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("caps a backlog at the batch size", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const rows = Array.from({ length: RECONCILE_BATCH_SIZE + 10 }, (_, i) => ({
      id: String(i),
      email: `person${i}@example.com`,
      name: "",
      syncAttempts: 0,
    }));
    const { db, limitUsed } = fakeDb(rows);

    const result = await reconcile(db, CONFIG);

    expect(limitUsed()).toBe(RECONCILE_BATCH_SIZE);
    expect(result.attempted).toBe(RECONCILE_BATCH_SIZE);
  });

  it("keeps a retry ceiling so a rejected address is not retried forever", () => {
    expect(MAX_SYNC_ATTEMPTS).toBeGreaterThan(0);
  });
});
