import { afterEach, describe, expect, it, vi } from "vitest";

import { readListmonkConfig, sendDoubleOptIn } from "./listmonk";

const CONFIG = {
  baseUrl: "https://lists.mrdemonwolf.com",
  apiUser: "conpaws-web",
  apiToken: "token",
  listId: 3,
};

const COMPLETE_ENV = {
  LISTMONK_BASE_URL: "https://lists.mrdemonwolf.com",
  LISTMONK_API_USER: "conpaws-web",
  LISTMONK_API_TOKEN: "token",
  LISTMONK_LIST_ID: "3",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readListmonkConfig", () => {
  it("reads a complete configuration", () => {
    expect(readListmonkConfig(COMPLETE_ENV)).toEqual(CONFIG);
  });

  it("returns null when any part is missing", () => {
    for (const key of Object.keys(COMPLETE_ENV)) {
      const partial = { ...COMPLETE_ENV, [key]: undefined };
      expect(readListmonkConfig(partial)).toBeNull();
    }
  });

  it("returns null when the list id is not a positive integer", () => {
    for (const value of ["not-a-number", "0", "-1"]) {
      expect(
        readListmonkConfig({ ...COMPLETE_ENV, LISTMONK_LIST_ID: value }),
      ).toBeNull();
    }
  });

  it("tolerates a trailing slash on the base URL", () => {
    expect(
      readListmonkConfig({
        ...COMPLETE_ENV,
        LISTMONK_BASE_URL: "https://lists.mrdemonwolf.com/",
      })?.baseUrl,
    ).toBe("https://lists.mrdemonwolf.com");
  });
});

describe("sendDoubleOptIn", () => {
  it("creates the subscriber on the waitlist list", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: { id: 7 } }));

    await expect(
      sendDoubleOptIn(CONFIG, { email: "person@example.com", name: "Paws" }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://lists.mrdemonwolf.com/api/subscribers");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "token conpaws-web:token",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      email: "person@example.com",
      name: "Paws",
      status: "enabled",
      lists: [3],
      // False is what makes listmonk send its own opt-in confirmation. Flipping
      // this to true would silently mark people confirmed without asking them.
      preconfirm_subscriptions: false,
    });
  });

  it("sends exactly one request on the happy path", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: { id: 7 } }));

    await sendDoubleOptIn(CONFIG, { email: "person@example.com", name: "" });

    // Creating the subscriber already triggers the opt-in email. A follow-up
    // /optin call here would send a second one.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("treats a duplicate address as already handled", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("email exists", { status: 409 }));

    await expect(
      sendDoubleOptIn(CONFIG, { email: "person@example.com", name: "" }),
    ).resolves.toEqual({ ok: true });

    // No lookup follow-up: resolving the subscriber would need listmonk's
    // `subscribers:sql_query` permission, which is arbitrary read SQL.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("reports a rejection with its status and body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("invalid token", { status: 401 }),
    );

    await expect(
      sendDoubleOptIn(CONFIG, { email: "person@example.com", name: "" }),
    ).resolves.toEqual({ ok: false, status: 401, detail: "invalid token" });
  });

  it("reports a network failure rather than throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(
      sendDoubleOptIn(CONFIG, { email: "person@example.com", name: "" }),
    ).resolves.toEqual({ ok: false, status: 0, detail: "network down" });
  });
});
