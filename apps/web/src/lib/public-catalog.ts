import { z } from "zod";

const availability = z.enum([
  "unknown",
  "not-open",
  "open",
  "waitlist",
  "sold-out",
  "closed",
]);
const scheduleStatus = z.enum(["not-released", "partial", "complete"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Strict public shape. Unknown/private fields are stripped before responses. */
export const publicConventionSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  acronym: z.string(),
  city: z.string(),
  region: z.string(),
  country: z.string(),
  startsOn: isoDate,
  endsOn: isoDate,
  timezone: z.string().min(1),
  venue: z.string(),
  availability,
  scheduleStatus,
  revision: z.number().int().positive(),
  sessions: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string(),
      room: z.string(),
      startsAt: z.string().min(1),
      endsAt: z.string().min(1),
      status: z.enum(["scheduled", "cancelled"]),
    }),
  ),
});

export type PublicConvention = z.infer<typeof publicConventionSchema>;

export interface PublishedCatalogDatabase {
  prepare(query: string): {
    bind(value: string): {
      first<T>(): Promise<T | null>;
    };
    all<T>(): Promise<{ results?: T[] }>;
  };
}

export function parsePublicSnapshot(json: string): PublicConvention {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("Published catalog snapshot is not valid JSON.");
  }
  const parsed = publicConventionSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Published catalog snapshot does not match the public schema.",
    );
  }
  return parsed.data;
}

export async function listPublishedSnapshots(
  database: PublishedCatalogDatabase,
) {
  const result = await database
    .prepare(
      `SELECT r.snapshot_json
         FROM convention_revisions r
         JOIN conventions c
           ON c.id = r.convention_id
          AND c.published_revision = r.revision
        WHERE c.status = 'published'
        ORDER BY json_extract(r.snapshot_json, '$.startsOn'),
                 json_extract(r.snapshot_json, '$.name')`,
    )
    .all<{ snapshot_json: string }>();
  return (result.results ?? []).map((row) =>
    parsePublicSnapshot(row.snapshot_json),
  );
}

export async function getPublishedSnapshot(
  database: PublishedCatalogDatabase,
  slug: string,
) {
  const result = await database
    .prepare(
      `SELECT r.snapshot_json
         FROM convention_revisions r
         JOIN conventions c
           ON c.id = r.convention_id
          AND c.published_revision = r.revision
        WHERE c.status = 'published'
          AND c.published_slug = ?
        LIMIT 1`,
    )
    .bind(slug)
    .first<{ snapshot_json: string }>();
  return result ? parsePublicSnapshot(result.snapshot_json) : null;
}

export function catalogResponseHeaders() {
  return {
    "Cache-Control":
      "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
}

export function catalogErrorResponse(status = 503) {
  return Response.json(
    { error: status === 404 ? "not_found" : "catalog_unavailable" },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
