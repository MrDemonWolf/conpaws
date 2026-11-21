# AGENTS.md

Public catalog API Worker. Root [AGENTS.md](../../AGENTS.md) also applies. Paths in the preserved guidance below are relative to the repository root unless stated otherwise.

Read [admin guidance](../admin/AGENTS.md) for catalog ownership/publication and [infrastructure guidance](../../packages/infra/AGENTS.md) for bindings. Do not turn planned premium/cloud behavior into an implemented claim.

## API boundary

- **Backend (`apps/api`):** the public API is its own Cloudflare Worker, `conpaws-api`, on **api.conpaws.com** (Hono; routes under `/v1`, no `/api` prefix). It serves the read-only published catalog (`GET /v1/conventions`, `/v1/conventions/{slug}`, `/v1/conventions/{slug}/schedule`, plus `/health`) from the admin-owned catalog D1 through `apps/api/src/catalog.ts`, the only module allowed to touch `CATALOG_DB` (a test enforces it). The website serves its own waitlist and health endpoints. All public catalog endpoints live on the API Worker. Planned on the same Worker: tRPC + Better-Auth (pin >=1.6.x, per-request factory), KV cache, Queues. **No RLS in D1** — all authorization happens in the Worker/tRPC layer. Public assets live in the separate `conpaws-cdn` R2 bucket on **cdn.conpaws.com**; it is not bound to this public Worker.

### Database Schema

The local expo-sqlite/Drizzle schema in `apps/native/src/db/` contains `conventions`, `convention_events`, and `offline_queue`, plus versioned bootstrap/migration and repository tests. The planned cloud D1 schema includes `profiles`, `username_blocklist`, `convention_directory`, `shared_conventions`, `shared_events`, and `verification_requests`. Full cloud indexing rationale is in the Technical Blueprint's **Data Model, Auth & Profiles** page in Notion. D1 rules that shape the planned schema: index every queried column (billing counts scanned rows), 100 bound params per query (chunk bulk imports), `db.batch()` is the only transaction primitive, no RLS.
