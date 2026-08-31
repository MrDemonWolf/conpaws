import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCloudflareContext = vi.hoisted(() => vi.fn());
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

import { GET } from "./route";

const COUNT_URL = "https://conpaws.com/api/waitlist/count";

/** The route now reads the request URL, so every call needs one. */
function get(url: string = COUNT_URL) {
  return GET(new Request(url));
}

const ENV = {
  LISTMONK_BASE_URL: "https://lists.mrdemonwolf.com",
  LISTMONK_API_USER: "conpaws-web",
  LISTMONK_API_TOKEN: "token",
  LISTMONK_LIST_ID: "3",
};

function listResponse(confirmed: unknown) {
  return new Response(
    JSON.stringify({ data: { subscriber_statuses: { confirmed } } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  getCloudflareContext.mockReturnValue({ env: ENV });
});

afterEach(() => {
  vi.restoreAllMocks();
  getCloudflareContext.mockReset();
});

/**
 * The null-vs-zero contract is the whole point of this route and was untested.
 *
 * Zero is a claim — "nobody has signed up" — and an outage must never make it.
 * The badge falls back to its static number on null, so every failure path here
 * has to answer null rather than a number.
 */
describe("GET /api/waitlist/count", () => {
  it("returns the confirmed count from listmonk", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(listResponse(42));

    const response = await get();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 42 });
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=300",
    );
  });

  it("passes a real zero through", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(listResponse(0));

    await expect((await get()).json()).resolves.toEqual({ count: 0 });
  });

  it("answers null, not zero, when listmonk is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));

    await expect((await get()).json()).resolves.toEqual({ count: null });
  });

  it("answers null when listmonk errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );

    await expect((await get()).json()).resolves.toEqual({ count: null });
  });

  it("answers null when the payload has no confirmed count", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(listResponse(undefined));

    await expect((await get()).json()).resolves.toEqual({ count: null });
  });

  it("answers null when listmonk is not configured", async () => {
    getCloudflareContext.mockReturnValue({ env: {} });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect((await get()).json()).resolves.toEqual({ count: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers null with no Worker context at all", async () => {
    getCloudflareContext.mockImplementation(() => {
      throw new Error("no context");
    });

    const response = await get();
    await expect(response.json()).resolves.toEqual({ count: null });
    // Cached only briefly, so an outage cannot pin the page to a stale answer.
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=30, s-maxage=30",
    );
  });

  it("refuses a cache-busting query string without calling listmonk", async () => {
    getCloudflareContext.mockReturnValue({ env: ENV });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await get(`${COUNT_URL}?1`);

    // The edge cache keys on the full URL, so an unbounded set of query
    // strings would each miss and hit listmonk once. Refusing here is what
    // stops a public URL from amplifying into our own mail server.
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
