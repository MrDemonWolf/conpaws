# ConPaws OTA activation

Deploy the shared control plane before adding `expo-updates` to a client build.
Store CI does not deploy the service.

Live bootstrap verified on 2026-10-15: the Dokploy `updates` project and
`production` environment exist with the XPRem Compose service and the deployed
PostgreSQL 16 service `xprem-control-db`, matching XPRem's official quickstart.
Dokploy reports the database deployment completed, internal port 5432, and no
external port. Its `dokploy-network` membership and database backups remain
unverified/unconfigured. A prior PostgreSQL 18.6 smoke was incomplete:
`/health` returned 200, `/dashboard` returned 503, and only 19 public tables
appeared. The XPRem service is not deployed and the public tunnel route is not
verified. Reuse Dokploy's existing `dokploy-project-backups` R2 destination for
database dumps under `xprem-control-db/`. Its saved credential was exposed in
the browser accessibility view during inspection; rotate and test it manually,
checking whether other destinations share it, before scheduling backups.

- [x] Create the shared Dokploy project and production environment.
- [x] Create and deploy the standalone PostgreSQL 16 `xprem-control-db` service
  with no public port.
- [ ] Verify it shares `dokploy-network` with XPRem. Rotate the exposed general
  Dokploy R2 credential without disrupting any shared use; configure nightly
  PostgreSQL backups in `dokploy-project-backups` under `xprem-control-db/` and
  prove a restore. Pass a complete isolated
  dashboard/database smoke before connecting XPRem.
- [ ] Recreate the private `mrdemonwolf-ota-assets` and
  `mrdemonwolf-ota-backups` R2 buckets with the documented 90-day retention
  locks. Both empty buckets were deleted on 2026-10-16; their prior bucket
  configuration and locks no longer exist.
- [ ] Deploy the existing descriptor using `infra/xprem/README.md` to the one
  shared control plane for every product. Serve `updates.mrdemonwolf.com`
  through the existing Cloudflare Tunnel to private `http://xprem:3000`. Verify
  xprem, `xprem-control-db`, and `cloudflared` share external `dokploy-network`.
  Keep one xprem replica on `CACHE_MODE=local`; add standalone Redis only if the
  service later scales to multiple replicas. Do not add a public port, Dokploy
  domain, or separate TLS certificate. Back up the database and objects and
  prove a restore before treating it as production-ready.
- [ ] Create or identify the ConPaws app record. Record its exact UUID. Give it
  its own signing material, publisher token, branches and channels. Never use
  another product's app UUID or token.
- [ ] Map `dev` and preview builds to the `staging` channel and `main` production
  builds to the `production` channel. Staging must never publish into production.
- [ ] After the service is healthy and the exact ConPaws app UUID exists, run
  `npx --no-install expo install expo-updates` and `npx --yes eoas@3.2.6 init`
  from `apps/native`. Use `https://updates.mrdemonwolf.com`,
  `certs/certificate.pem`, runtime `1.0.0-r1`, and the dashboard UUID; do not
  accept a detected EAS project ID as the xprem app UUID.
- [ ] Review the generated update headers. Require `expo-channel-name` to resolve
  to `staging` or `production`, `expo-app-id` to equal the ConPaws dashboard UUID,
  and `xprem-branch` to use an immutable `release-<sha>` name. Never ship an
  unresolved `process.env.RELEASE_CHANNEL` value.
- [ ] Configure the ConPaws update URL, signing certificate and runtime policy,
  then produce new signed binaries.
  Existing binaries without `expo-updates` cannot receive OTA updates.
- [ ] Test signed updates on physical iOS and Android: cold start, offline
  start, wrong runtime rejection and rollback. Include the Watch/widget
  boundary: native changes require new store binaries.
- [ ] Add one publish job to the existing release workflow only after those
  checks pass. Publish JS/assets after CI, scoped to the matching channel and
  compatible runtime. Keep a manual production gate initially.

The source of truth for deployment is the existing runbook and the Notion
**OTA Updates** decision page. Check current xprem and Expo documentation at
implementation time; this checklist does not claim deployment or authorize an
update publish or channel mutation.
