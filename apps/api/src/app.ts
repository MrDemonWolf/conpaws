import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./bindings";
import {
  getPublicPublishedSnapshot,
  listPublicPublishedSnapshots,
} from "./catalog";

/**
 * The public API at api.conpaws.com.
 *
 * Today it is the read-only convention catalog the native app downloads;
 * the planned Hono + tRPC + Better-Auth backend grows out of this Worker.
 * Routes are versioned under /v1 and never carry an /api prefix: the host
 * already says what this is.
 */

// s-maxage is honoured by Workers Cache (enabled on the Worker in
// alchemy.run.ts and wrangler.jsonc); max-age=0 keeps clients revalidating.
const CATALOG_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
  "X-Content-Type-Options": "nosniff",
} as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function catalogError(status: 404 | 503) {
  return Response.json(
    { error: status === 404 ? "not_found" : "catalog_unavailable" },
    { status, headers: NO_STORE_HEADERS },
  );
}

function catalogJson(body: unknown) {
  return Response.json(body, { headers: CATALOG_HEADERS });
}

export function createApp() {
  const app = new Hono<{ Bindings: Bindings }>();

  // A public, read-only catalog: any origin may read it from a browser.
  app.use(
    "/v1/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      maxAge: 86_400,
    }),
  );

  app.get("/health", (c) =>
    c.json({ status: "ok" }, 200, { "Cache-Control": "no-store" }),
  );

  app.get("/v1/conventions", async (c) => {
    try {
      const conventions = await listPublicPublishedSnapshots(c.env);
      return catalogJson({ version: 1, conventions });
    } catch {
      return catalogError(503);
    }
  });

  app.get("/v1/conventions/:slug", async (c) => {
    try {
      const convention = await getPublicPublishedSnapshot(
        c.env,
        c.req.param("slug"),
      );
      if (!convention) return catalogError(404);
      return catalogJson({ version: 1, convention });
    } catch {
      return catalogError(503);
    }
  });

  app.get("/v1/conventions/:slug/schedule", async (c) => {
    try {
      const convention = await getPublicPublishedSnapshot(
        c.env,
        c.req.param("slug"),
      );
      if (!convention) return catalogError(404);
      return catalogJson({
        version: 1,
        conventionId: convention.id,
        slug: convention.slug,
        revision: convention.revision,
        timezone: convention.timezone,
        status: convention.scheduleStatus,
        sessions: convention.sessions,
      });
    } catch {
      return catalogError(503);
    }
  });

  app.notFound(() =>
    Response.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE_HEADERS },
    ),
  );

  return app;
}
