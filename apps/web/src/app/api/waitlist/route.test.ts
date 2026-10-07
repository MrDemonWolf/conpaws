import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LAUNCH } from "@/content/launch";

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
  WAITLIST_ACCEPTING_SIGNUPS: "true",
};

/** Covers only the query shapes the route builds. */
function fakeDb(
  existing: unknown[] = [],
  claimSucceeds = true,
  recentFromIp = 0,
) {
  const inserted: unknown[] = [];

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(existing) }),
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

  const d1 = {
    prepare: () => ({
      bind: (...values: unknown[]) => ({
        all: async () => {
          if (recentFromIp >= 5) return { results: [] };
          if (!claimSucceeds) return { results: [{ id: "concurrent" }] };
          inserted.push({
            id: values[0],
            email: values[1],
            name: values[2],
            source: values[3],
            consentCopy: values[4],
            ip: values[5],
            ipBucket: values[6],
            userAgent: values[7],
            country: values[8],
            referer: values[9],
            utmSource: values[10],
            utmMedium: values[11],
            utmCampaign: values[12],
          });
          return { results: [{ id: values[0] }] };
        },
      }),
    }),
  };

  return { d1, db, inserted };
}

function wireWorker(
  existing: unknown[] = [],
  claimSucceeds = true,
  recentFromIp = 0,
) {
  const { d1, db, inserted } = fakeDb(existing, claimSucceeds, recentFromIp);
  const waitUntil = vi.fn();
  createDb.mockReturnValue(db);
  getCloudflareContext.mockReturnValue({
    env: { ...ENV, DB: d1 },
    ctx: { waitUntil },
  });
  return { inserted, waitUntil };
}

function request(body: unknown, ip = "203.0.113.7"): Request {
  return new Request("https://conpaws.com/api/waitlist", {
    method: "POST",
    // Cloudflare always sets cf-connecting-ip in front of the Worker, and the
    // per-IP cap is skipped without it, so the fixture carries one.
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
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
  it("pauses new signups outside waitlist mode", async () => {
    const previousMode = LAUNCH.mode;
    LAUNCH.mode = "maintenance";
    try {
      const response = await POST(request({ email: "person@example.com" }));
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("300");
    } finally {
      LAUNCH.mode = previousMode;
    }
  });

  it("rejects malformed signup data", async () => {
    const response = await POST(
      request({ email: "not-an-email", elapsedMs: 3_000 }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "That email doesn't look right.",
    });
  });

  it("silently accepts and counts honeypot submissions without PII", async () => {
    wireWorker();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(
      request({
        email: "bot@example.com",
        favoriteSeason: "spam",
        elapsedMs: 3_000,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(info).toHaveBeenCalledWith("waitlist.rejected", {
      reason: "honeypot",
    });
  });

  it("silently accepts and counts timing rejections", async () => {
    wireWorker();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(
      request({ email: "bot@example.com", elapsedMs: 1_999 }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(info).toHaveBeenCalledWith("waitlist.rejected", {
      reason: "timing",
    });
  });

  it("closes POST when the server switch is false", async () => {
    const { d1, db } = fakeDb();
    createDb.mockReturnValue(db);
    getCloudflareContext.mockReturnValue({
      env: { ...ENV, DB: d1, WAITLIST_ACCEPTING_SIGNUPS: "false" },
      ctx: { waitUntil: vi.fn() },
    });

    const response = await POST(
      request({ email: "person@example.com", elapsedMs: 3_000 }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "closed" });
  });

  it("rejects control characters and unsupported name characters", async () => {
    for (const name of ["\nPaws", "Paws 2", "🐾"]) {
      const response = await POST(
        request({ email: "person@example.com", name, elapsedMs: 3_000 }),
      );
      expect(response.status).toBe(400);
    }
  });

  it("does not claim success or log PII before persistence is available", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(
      request({ email: "person@example.com", name: "Paws", elapsedMs: 3_000 }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("300");
    await expect(response.json()).resolves.toEqual({
      error:
        "Signups are temporarily unavailable. Please try again in a few minutes.",
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
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
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
      ipBucket: "203.0.113.7",
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

  it("stores the IPv6 /64 admission bucket", async () => {
    const { inserted } = wireWorker();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
    );
    const response = await POST(
      request(
        {
          email: "person@example.com",
          elapsedMs: 3_000,
          turnstileToken: "good-token",
        },
        "2001:db8:abcd:12:ffff::1",
      ),
    );

    expect(response.status).toBe(200);
    expect(inserted[0]).toMatchObject({
      ip: "2001:db8:abcd:12:ffff::1",
      ipBucket: "2001:db8:abcd:12::/64",
    });
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
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
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

  it("does not recreate or send mail to an erased address", async () => {
    const { inserted, waitUntil } = wireWorker([
      {
        id: "erased",
        email: "person@example.com",
        name: "",
        status: "unsubscribed",
        erasedAt: new Date(),
        syncedAt: new Date(),
        syncAttempts: 0,
        syncAttemptedAt: null,
      },
    ]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
    );
    const response = await POST(
      request({
        email: "person@example.com",
        elapsedMs: 3000,
        turnstileToken: "good-token",
      }),
    );
    expect(response.status).toBe(200);
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
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
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
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
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
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
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

  it("refuses a new address once one IP has had its fill for the hour", async () => {
    // Five already, and the cap is five. The per-address cooldown cannot see
    // this: every one of these is a DIFFERENT inbox, each getting exactly one
    // legitimate-looking confirmation it never asked for.
    const { inserted, waitUntil } = wireWorker([], true, 5);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
    );

    const response = await POST(
      request({
        email: "sixth@example.com",
        elapsedMs: 3_000,
        turnstileToken: "good-token",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    // Nothing written and nothing mailed.
    expect(inserted).toHaveLength(0);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("still accepts a signup while the IP is under the cap", async () => {
    const { inserted, waitUntil } = wireWorker([], true, 4);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        success: true,
        hostname: "conpaws.com",
        action: "waitlist",
      }),
    );

    const response = await POST(
      request({
        email: "fifth@example.com",
        elapsedMs: 3_000,
        turnstileToken: "good-token",
      }),
    );

    expect(response.status).toBe(200);
    expect(inserted).toHaveLength(1);
    expect(waitUntil).toHaveBeenCalled();
  });
});
