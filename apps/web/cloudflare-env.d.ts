import type { WebEnv } from "@conpaws/infra/alchemy.run";

// Bindings are typed from the Alchemy program that provisions them, so
// renaming a binding in packages/infra/alchemy.run.ts is a type error here
// rather than a runtime `undefined` in production.
declare global {
  interface CloudflareEnv extends WebEnv {
    // External admin-owned binding: absent until its D1 UUID is configured.
    CATALOG_DB?: D1Database;
  }
}

export {};
