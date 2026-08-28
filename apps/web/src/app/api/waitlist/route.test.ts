import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const getCloudflareContext = vi.hoisted(() => vi.fn());
const createDb = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));
vi.mock("../../../db", () => ({ createDb }));

const ENV = {
  DB: {},
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  LISTMONK_BASE_URL: "https://lists.mrdemonwolf.com",
  LISTMONK_API_USER: "conpaws-web",
  LISTMONK_API_TOKEN: "listmonk-token",
  LISTMONK_LIST_ID: "3",
};

/** Covers only the two query shapes the route builds. */
function fakeDb(existing: unknown[] = [], claimSucceeds = true) {
  const inserted: unknown[] = [];

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(existing) }),
      }),
    }),
    insert: () => ({
      values: (row: unknown) => ({
        onConflictDoNothing: () => ({
          // RETURNING is empty when the INSERT lost to a concurrent one.
          returning: () => {
            if (!claimSucceeds) return Promise.resolve([]);
            inserted.push(row);
            return Promise.resolve([{ id: "inserted" }]);
          },
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () =>
            Promise.resolve(claimSucceeds ? [{ id: "claimed" }] : []),
        }),
      }),
    }),
  };

  return { db, inserted };
}

function wireWorker(existing: unknown[] = [], claimSucceeds = true) {
  const { db, inserted } = fakeDb(existing, claimSucceeds);
  const waitUntil = vi.fn();
  createDb.mockReturnValue(db);
  getCloudflareContext.mockReturnValue({ env: ENV, ctx: { waitUntil } });
  return { inserted, waitUntil };
}

function request(body: unknown): Request {
  return new Request("https://conpaws.com/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  // Default: no Worker context, which is the shipped fail-closed state.
  getCloudflareContext.mockImplementation(() => {
    throw new Error("no cloudflare context");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("POST /api/waitlist", () => {
  it("rejects malformed signup data", async () => {
    const response = await POST(
      request({ email: "not-an-email", elapsedMs: 3_000 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "That email doesn't look right.",
    });
  });

  it("silently accepts bot-shaped submissions", async () => {
    const response = await POST(
      request({
        email: "bot@example.com",
        honeypot: "spam",
        elapsedMs: 3_000,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not claim success or log PII before persistence is available", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(
      request({ email: "person@example.com", name: "Paws", elapsedMs: 3_000 }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("86400");
    await expect(response.json()).resolves.toEqual({
      error: "Beta registration is not open yet. Please check back soon.",
    });
    expect(info).not.toHaveBeenCalled();
  });

  it("rejects a submission Turnstile does not verify", async () => {
    wireWorker();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: false }),
    );

    const response = await POST(
      request({
        email: "person@example.com",
        elapsedMs: 3_000,
        turnstileToken: "bad-token",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "We couldn't verify that you're human. Please try again.",
    });
  });

  it("stores the consent record and pushes to listmonk outside the response", async () => {
    const { inserted, waitUntil } = wireWorker();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: true }),
    );

    const response = await POST(
      new Request("https://conpaws.com/api/waitlist", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
          "cf-ipcountry": "US",
          "user-agent": "test-agent",
        },
        body: JSON.stringify({
          email: "  Person@Example.COM ",
          name: "Paws",
          elapsedMs: 3_000,
          turnstileToken: "good-token",
          utmSource: "bluesky",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      email: "person@example.com",
      name: "Paws",
      source: "web",
      ip: "203.0.113.7",
      country: "US",
      userAgent: "test-agent",
      utmSource: "bluesky",
    });
    // The row IS the consent record, so the wording shown at signup is stored.
    expect(
      String((inserted[0] as { consentCopy: string }).consentCopy),
    ).not.toBe("");

    // listmonk is contacted after the response, never as part of it.
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("does not re-send confirmation to an address listmonk already accepted", async () => {
    const { inserted, waitUntil } = wireWorker([
      {
        id: "existing",
        email: "person@example.com",
        name: "Paws",
        status: "pending",
        syncedAt: new Date(),
        syncAttempts: 0,
        syncAttemptedAt: null,
      },
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: true }),
    );

    const response = await POST(
      request({
        email: "person@example.com",
        elapsedMs: 3_000,
        turnstileToken: "good-token",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(inserted).toHaveLength(0);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("retries an address listmonk has never accepted", async () => {
    const { waitUntil } = wireWorker([
      {
        id: "existing",
        email: "person@example.com",
        name: "Paws",
        status: "pending",
        syncedAt: null,
        syncAttempts: 1,
        syncAttemptedAt: null,
      },
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: true }),
    );

    const response = await POST(
      request({
        email: "person@example.com",
        elapsedMs: 3_000,
        turnstileToken: "good-token",
      }),
    );

    expect(response.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the listmonk configuration is incomplete", async () => {
    const { db } = fakeDb();
    createDb.mockReturnValue(db);
    getCloudflareContext.mockReturnValue({
      env: { ...ENV, LISTMONK_API_TOKEN: undefined },
      ctx: { waitUntil: vi.fn() },
    });

    const response = await POST(
      request({
        email: "person@example.com",
        elapsedMs: 3_000,
        turnstileToken: "good-token",
      }),
    );

    expect(response.status).toBe(503);
  });

  it("does not send when a concurrent request already claimed the address", async () => {
    const { inserted, waitUntil } = wireWorker([], false);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: true }),
    );

    const response = await POST(
      request({
        email: "person@example.com",
        elapsedMs: 3_000,
        turnstileToken: "good-token",
      }),
    );

    // The visitor still sees success — they are on the list either way.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(inserted).toHaveLength(0);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("refuses to re-send inside the cooldown, so the form cannot mailbomb", async () => {
    const { waitUntil } = wireWorker([
      {
        id: "existing",
        email: "person@example.com",
        name: "Paws",
        status: "pending",
        syncedAt: null,
        syncAttempts: 1,
        // A confirmation went out moments ago.
        syncAttemptedAt: new Date(),
      },
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ success: true }),
    );

    const response = await POST(
      request({
        email: "person@example.com",
        elapsedMs: 3_000,
        turnstileToken: "good-token",
      }),
    );

    expect(response.status).toBe(200);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
