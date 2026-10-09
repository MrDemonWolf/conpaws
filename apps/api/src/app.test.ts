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
    expect(missing.headers.get("cache-control")).toBe("no-store");

    const unavailable = await app.request("/v1/conventions", {}, env());
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: "catalog_unavailable" });
  });

  it("does not serve the catalog under the old /api prefix", async () => {
    const response = await app.request("/api/v1/conventions", {}, env());
    expect(response.status).toBe(404);
  });
});
