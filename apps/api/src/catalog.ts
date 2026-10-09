import { z } from "zod";
import type { Bindings } from "./bindings";

/**
 * Read-only access to the published catalog.
 *
 * This is the only module that may touch `CATALOG_DB`. The binding has write
 * access (D1 has no row-level security), so the read-only boundary is the
 * code in this file: snapshot reads keyed on the convention's current
 * published revision, and nothing else. `catalog.binding.test.ts` fails the
 * build if the binding name shows up anywhere else under src/.
 */

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

/** Strict public shape. Unknown and private fields are stripped before responses. */
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

/** The slice of D1 the read queries use, so tests can hand in a fake. */
export interface PublishedCatalogDatabase {
  prepare(query: string): {
    bind(value: string): {
      first<T>(): Promise<T | null>;
    };
    all<T>(): Promise<{ results?: T[] }>;
  };
}

export class CatalogUnavailableError extends Error {
  constructor(message = "Public catalog binding is unavailable.") {
    super(message);
    this.name = "CatalogUnavailableError";
  }
}

/** Keep the writable D1 handle inside this read-query module. */
function requireCatalogDatabase(env: Bindings): PublishedCatalogDatabase {
  if (!env.CATALOG_DB) throw new CatalogUnavailableError();
  return env.CATALOG_DB;
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

/**
 * The two reads the API exposes. Handlers get these and nothing else: the
 * raw handle never leaves this module, so no other file can run its own SQL
 * against the writable binding.
 */
export function listPublicPublishedSnapshots(env: Bindings) {
  return listPublishedSnapshots(requireCatalogDatabase(env));
}

export function getPublicPublishedSnapshot(env: Bindings, slug: string) {
  return getPublishedSnapshot(requireCatalogDatabase(env), slug);
}
