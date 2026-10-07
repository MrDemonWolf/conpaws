import { afterEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db";
import {
  ipBucket,
  MAX_SYNC_ATTEMPTS,
  RECONCILE_BATCH_SIZE,
  RECONCILE_MAX_AGE_MS,
  RESEND_COOLDOWN_MS,
  reconcile,
  resendAllowed,
  syncRow,
  syncSubscriptionStatuses,
  UNCONFIRMED_RETENTION_MS,
} from "./waitlist";

const CONFIG = {
  baseUrl: "https://lists.mrdemonwolf.com",
  apiUser: "conpaws-web",
  apiToken: "token",
  listId: 3,
};

type PendingRow = {
  id: string;
  email: string;
  name: string;
  syncAttempts: number;
  erasedAt?: Date | null;
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
  let orderByValue: unknown;

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
            orderBy: (value: unknown) => {
              orderByValue = value;
              return {
                limit: (value: number) => {
                  limit = value;
                  return Promise.resolve(
                    pending.filter((row) => !row.erasedAt).slice(0, value),
                  );
                },
              };
            },
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
    orderByUsed: () => orderByValue,
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

  it("records an address-level failure without changing the claimed count", async () => {
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
    // again on the next fire. A 4xx is about the address, so it is allowed to
    // spend the attempt claimRow took.
    expect(updates[0]).not.toHaveProperty("syncedAt");
    expect(updates[0]).not.toHaveProperty("syncAttempts");
  });

  it("does not refund a claimed attempt when listmonk is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));
    const { db, updates } = fakeDb();

    await expect(
      syncRow(db, CONFIG, {
        id: "a",
        email: "person@example.com",
        name: "",
        syncAttempts: 3,
      }),
    ).resolves.toBe(false);

    expect(updates[0]).not.toHaveProperty("syncAttempts");
  });

  it("does not refund a claimed attempt when listmonk answers 5xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("down", { status: 503 }),
    );
    const { db, updates } = fakeDb();

    await expect(
      syncRow(db, CONFIG, {
        id: "a",
        email: "person@example.com",
        name: "",
        syncAttempts: 1,
      }),
    ).resolves.toBe(false);

    expect(updates[0]).toMatchObject({ syncError: "503: down" });
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

  it("excludes erased rows from replay even if their state is stale", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { db, selectWhereUsed } = fakeDb([
      {
        id: "erased",
        email: "erased@example.com",
        name: "",
        syncAttempts: 0,
        erasedAt: new Date(),
      },
    ]);
    await expect(reconcile(db, CONFIG)).resolves.toMatchObject({
      attempted: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(describePredicate(selectWhereUsed()).columns).toContain("erased_at");
  });

  it("syncs unsubscribe and confirmation states, anonymises, and purges after 30 days", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const deletes: unknown[] = [];
    const db = {
      update: () => ({
        set: (value: Record<string, unknown>) => ({
          where: async () => {
            writes.push(value);
          },
        }),
      }),
      delete: () => ({
        where: async (value: unknown) => {
          deletes.push(value);
        },
      }),
    } as unknown as Db;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ data: { results: [{ email: "left@example.com" }] } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { results: [{ email: "confirmed@example.com" }] },
        }),
      );
    await expect(syncSubscriptionStatuses(db, CONFIG)).resolves.toEqual({
      updated: 2,
    });
    expect(writes[0]).toMatchObject({
      status: "unsubscribed",
      name: "",
      confirmedAt: null,
      ip: null,
      ipBucket: null,
      userAgent: null,
      country: null,
      referer: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
    expect(writes[1]).toMatchObject({ status: "confirmed" });
    expect(writes[1]).toHaveProperty("confirmedAt");
    expect(deletes).toHaveLength(1);
    const purge = describePredicate(deletes[0]);
    expect(purge.values).toContain("pending");
    expect(purge.columns).toContain("created_at");
    expect(
      purge.values.some(
        (value) =>
          value instanceof Date &&
          value.getTime() <= Date.now() - UNCONFIRMED_RETENTION_MS,
      ),
    ).toBe(true);
    expect(UNCONFIRMED_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("orders by oldest sync attempt and excludes rows older than seven days", async () => {
    const { db, selectWhereUsed, orderByUsed } = fakeDb([]);
    await reconcile(db, CONFIG);

    expect(describePredicate(orderByUsed()).columns).toContain(
      "sync_attempted_at",
    );
    const { columns, values } = describePredicate(selectWhereUsed());
    expect(columns).toContain("created_at");
    expect(values.some((value) => value instanceof Date)).toBe(true);
    expect(RECONCILE_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("ipBucket", () => {
  it("keeps IPv4 addresses and groups IPv6 addresses by /64", () => {
    expect(ipBucket("203.0.113.7")).toBe("203.0.113.7");
    expect(ipBucket("2001:db8:abcd:12::1")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:db8:abcd:12:ffff::1")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket(null)).toBeNull();
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
