import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { Bindings } from "./bindings";
import { fakeD1, snapshot } from "./test-support";

function env(bindings: Partial<Bindings> = {}): Bindings {
  return bindings;
}

describe("api.conpaws.com", () => {
  const app = createApp();

  it("answers the health probe without caching", async () => {
    const response = await app.request("/health", {}, env());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("serves the published list under /v1 with edge caching and open CORS", async () => {
    const { database } = fakeD1([{ snapshot_json: JSON.stringify(snapshot) }]);
    const response = await app.request(
      "/v1/conventions",
      { headers: { Origin: "https://conpaws.com" } },
      env({ CATALOG_DB: database as unknown as D1Database }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      version: number;
      conventions: Array<{ slug: string }>;
    };
    expect(body.version).toBe(1);
    expect(body.conventions.map((item) => item.slug)).toEqual(["demo-con"]);
    expect(response.headers.get("cache-control")).toContain("s-maxage=30");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("serves one edition and its schedule by published slug", async () => {
    const { database } = fakeD1([], {
      snapshot_json: JSON.stringify(snapshot),
    });
    const bindings = env({ CATALOG_DB: database as unknown as D1Database });

    const edition = await app.request("/v1/conventions/demo-con", {}, bindings);
    expect(edition.status).toBe(200);
    expect(
      ((await edition.json()) as { convention: { id: string } }).convention.id,
    ).toBe("demo-id");

    const schedule = await app.request(
      "/v1/conventions/demo-con/schedule",
      {},
      bindings,
    );
    expect(schedule.status).toBe(200);
    const body = (await schedule.json()) as {
      slug: string;
      revision: number;
      status: string;
      sessions: Array<{ id: string }>;
    };
    expect(body).toMatchObject({
      slug: "demo-con",
      revision: 2,
      status: "partial",
    });
    expect(body.sessions.map((session) => session.id)).toEqual(["event-one"]);
  });

  it("returns 404 for an unpublished slug and 503 without the catalog binding", async () => {
    const { database } = fakeD1([]);
    const missing = await app.request(
      "/v1/conventions/nobody",
      {},
      env({ CATALOG_DB: database as unknown as D1Database }),
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
    expect(missing.headers.get("cache-control")).toContain("s-maxage=30");

    const unavailable = await app.request("/v1/conventions", {}, env());
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "catalog_unavailable" });
    expect(unavailable.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects malformed and oversized slugs before querying D1", async () => {
    const { database, calls } = fakeD1([]);
    const bindings = env({ CATALOG_DB: database as unknown as D1Database });

    for (const path of [
      "/v1/conventions/a",
      "/v1/conventions/UPPERCASE",
      "/v1/conventions/sample--con",
      "/v1/conventions/sample%2Fcon/schedule",
      `/v1/conventions/${"a".repeat(97)}/schedule`,
    ]) {
      const response = await app.request(path, {}, bindings);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "not_found" });
    }

    expect(calls).toEqual([]);
  });

  it("rejects query variants before they can bypass the cache and query D1", async () => {
    const { database, calls } = fakeD1([]);
    const bindings = env({ CATALOG_DB: database as unknown as D1Database });

    for (const path of [
      "/v1/conventions?ignored=1",
      "/v1/conventions/nobody?ignored=1",
      "/v1/conventions/nobody/schedule?ignored=1",
    ]) {
      const response = await app.request(path, {}, bindings);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_request" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }

    expect(calls).toEqual([]);
  });

  it("does not serve the catalog under the old /api prefix", async () => {
    const response = await app.request("/api/v1/conventions", {}, env());
    expect(response.status).toBe(404);
  });
});
