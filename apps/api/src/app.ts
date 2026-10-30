import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./bindings";
import {
  getPublicPublishedSnapshot,
  listPublicPublishedSnapshots,
  publicConventionSlugSchema,
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

const NOT_FOUND_HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=30",
  "X-Content-Type-Options": "nosniff",
} as const;

const CATALOG_ERRORS = {
  400: "invalid_request",
  404: "not_found",
  503: "catalog_unavailable",
} as const;

function catalogError(status: keyof typeof CATALOG_ERRORS) {
  return Response.json(
    { error: CATALOG_ERRORS[status] },
    { status, headers: status === 404 ? NOT_FOUND_HEADERS : NO_STORE_HEADERS },
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

  // Queries do not change catalog results; reject cache-busting variants before they fan out D1 reads.
  app.get("/v1/conventions", async (c) => {
    if (new URL(c.req.url).search) return catalogError(400);
    try {
      const conventions = await listPublicPublishedSnapshots(c.env);
      return catalogJson({ version: 1, conventions });
    } catch {
      return catalogError(503);
    }
  });

  app.get("/v1/conventions/:slug", async (c) => {
    if (new URL(c.req.url).search) return catalogError(400);
    const slug = publicConventionSlugSchema.safeParse(c.req.param("slug"));
    if (!slug.success) return catalogError(404);
    try {
      const convention = await getPublicPublishedSnapshot(c.env, slug.data);
      if (!convention) return catalogError(404);
      return catalogJson({ version: 1, convention });
    } catch {
      return catalogError(503);
    }
  });

  app.get("/v1/conventions/:slug/schedule", async (c) => {
    if (new URL(c.req.url).search) return catalogError(400);
    const slug = publicConventionSlugSchema.safeParse(c.req.param("slug"));
    if (!slug.success) return catalogError(404);
    try {
      const convention = await getPublicPublishedSnapshot(c.env, slug.data);
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
