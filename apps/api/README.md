# @conpaws/api

The public API Worker at **api.conpaws.com**. It serves the read-only
convention catalog the native app downloads; the planned Hono + tRPC +
Better-Auth backend grows out of this Worker.

Routes are versioned under `/v1` with no `/api` prefix:

- `GET /health`
- `GET /v1/conventions` — current published editions
- `GET /v1/conventions/{slug}` — one published edition
- `GET /v1/conventions/{slug}/schedule` — its sessions and schedule status

Responses are edge-cached for 30 seconds through Workers Cache and readable from any origin. Every
route reads only the snapshot selected by the convention's current published
revision; drafts and staff-only fields never leave the admin database.

## Running locally

```sh
bun run --filter @conpaws/admin db:migrate:local   # once, creates the local catalog
bun dev:api                                          # http://127.0.0.1:8790
```

The dev server shares the admin app's local D1 state, so editions published in
the admin console at http://localhost:3003 appear here. Point the native app at
it with `EXPO_PUBLIC_CONPAWS_API_URL=http://127.0.0.1:8790` (iOS simulator) or
`http://10.0.2.2:8790` (Android emulator).

## Deployment

`packages/infra/alchemy.run.ts` owns production: the `conpaws-api` Worker on
api.conpaws.com, the catalog database it reads (created empty on first deploy,
so `/v1/conventions` answers an empty list until staff publish), and the
`conpaws-cdn` R2 bucket on cdn.conpaws.com. `wrangler.jsonc` here is for local
development only and must never carry a real database ID.
