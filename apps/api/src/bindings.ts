/**
 * Bindings the Worker receives from packages/infra/alchemy.run.ts.
 *
 * `CATALOG_DB` is the catalog database the admin console writes. D1 grants
 * write access; every public handler reads through `catalog.ts`, which is the
 * only module allowed to touch the binding (a test enforces that). Production
 * always binds it. It stays optional in the type so a missing binding in a
 * local or test environment answers 503 instead of crashing.
 *
 * `CDN_BUCKET` is the R2 bucket served at cdn.conpaws.com. Nothing reads it
 * yet; it is bound so uploads and signed delivery can land here without an
 * infrastructure change.
 */
export interface Bindings {
  CATALOG_DB?: D1Database;
  CDN_BUCKET?: R2Bucket;
}
