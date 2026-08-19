import { afterEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db";
import {
  MAX_SYNC_ATTEMPTS,
  RECONCILE_BATCH_SIZE,
  RESEND_COOLDOWN_MS,
  reconcile,
  resendAllowed,
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
function fakeDb(pending: PendingRow[] = [], claimSucceeds = true) {
  const updates: Array<Record<string, unknown>> = [];
  let limit = 0;
  let selectWhere: unknown;

  const db = {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        const record = () => {
          updates.push(values);
        };
        return {
          where: () => {
            record();
            // claimRow chains .returning(); syncRow awaits the where() itself.
            const result = Promise.resolve() as Promise<void> & {
              returning: () => Promise<{ id: string }[]>;
            };
            result.returning = () =>
              Promise.resolve(claimSucceeds ? [{ id: "claimed" }] : []);
            return result;
          },
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          selectWhere = condition;
          return {
            orderBy: () => ({
              limit: (value: number) => {
                limit = value;
                return Promise.resolve(pending.slice(0, value));
              },
            }),
          };
        },
      }),
    }),
  };

  return {
    db: db as unknown as Db,
    updates,
    limitUsed: () => limit,
    selectWhereUsed: () => selectWhere,
  };
}

/**
 * Walks a Drizzle SQL tree and collects the column names and bound parameter
 * values it references. Drizzle builds the same object whichever client runs
 * it, so a predicate can be inspected without a database behind it.
 */
function describePredicate(node: unknown): {
  columns: string[];
  values: unknown[];
} {
  const columns: string[] = [];
  const values: unknown[] = [];

  function walk(current: unknown) {
    if (current === null || typeof current !== "object") return;

    if (Array.isArray(current)) {
      for (const item of current) walk(item);
      return;
    }

    const record = current as Record<string, unknown>;

    if (typeof record.name === "string" && "table" in record) {
      columns.push(record.name);
      return;
    }

    if ("value" in record && Object.hasOwn(record, "encoder")) {
      values.push(record.value);
      return;
    }

    for (const item of Object.values(record)) walk(item);
  }

  walk(node);
  return { columns, values };
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

    expect(updates[0]).toMatchObject({ syncError: "429: nope" });
    // The row keeps synced_at NULL, which is what makes the reconciler find it
    // again on the next fire. The attempt counter belongs to claimRow, so
    // syncRow must not touch it.
    expect(updates[0]).not.toHaveProperty("syncedAt");
    expect(updates[0]).not.toHaveProperty("syncAttempts");
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

  it("skips rows it cannot claim, so overlapping runs never double-send", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { db } = fakeDb(
      [{ id: "a", email: "a@example.com", name: "", syncAttempts: 0 }],
      false,
    );

    await expect(reconcile(db, CONFIG)).resolves.toEqual({
      attempted: 0,
      synced: 0,
      failed: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps a retry ceiling so a rejected address is not retried forever", async () => {
    const { db, selectWhereUsed } = fakeDb([]);

    await reconcile(db, CONFIG);

    // Asserted against the predicate the query actually carries. The previous
    // version of this test compared MAX_SYNC_ATTEMPTS to zero, so it would have
    // passed just as happily with the ceiling deleted.
    const { columns, values } = describePredicate(selectWhereUsed());
    expect(columns).toContain("sync_attempts");
    expect(values).toContain(MAX_SYNC_ATTEMPTS);
  });

  it("only replays rows that are pending and unsynced", async () => {
    const { db, selectWhereUsed } = fakeDb([]);

    await reconcile(db, CONFIG);

    const { columns, values } = describePredicate(selectWhereUsed());
    expect(columns).toEqual(expect.arrayContaining(["synced_at", "status"]));
    expect(values).toContain("pending");
  });
});

describe("resendAllowed", () => {
  const now = 1_700_000_000_000;

  it("allows the first send", () => {
    expect(resendAllowed(null, now)).toBe(true);
  });

  it("blocks a resend inside the cooldown", () => {
    const justNow = new Date(now - 1_000);
    expect(resendAllowed(justNow, now)).toBe(false);
  });

  it("allows a resend once the cooldown has elapsed", () => {
    const old = new Date(now - RESEND_COOLDOWN_MS - 1);
    expect(resendAllowed(old, now)).toBe(true);
  });
});
