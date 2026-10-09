/**
 * Bindings the Worker receives from packages/infra/alchemy.run.ts.
 *
 * `CATALOG_DB` is the admin-owned catalog database. D1 grants write access;
 * every public handler reads through `catalog.ts`, which is the only module
 * allowed to touch the binding (a test enforces that). It is optional because
 * the binding is attached only once the admin stack has been deployed and its
 * database ID configured; until then the catalog routes answer 503.
 *
 * `CDN_BUCKET` is the R2 bucket served at cdn.conpaws.com. Nothing reads it
 * yet; it is bound so uploads and signed delivery can land here without an
 * infrastructure change.
 */
export interface Bindings {
  CATALOG_DB?: D1Database;
  CDN_BUCKET?: R2Bucket;
}
