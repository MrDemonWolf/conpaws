# MrDemonWolf, Inc. self-hosted OTA control plane

This deploys one shared [xprem](https://github.com/mercuretechnologies/xprem/releases/tag/v3.2.6) 3.2.6 control plane for MrDemonWolf, Inc. on Dokploy. It can serve ConPaws and future Expo apps. Deploying it alone does not enable any client or publish an update.

Durable metadata uses a standalone Dokploy PostgreSQL 16 service, matching XPRem's official [quickstart](https://mercure-technologies.gitbook.io/xprem/quickstart). Dokploy completed deployment of `xprem-control-db` on 2026-10-15. Its internal port is 5432 and no external port is assigned; verify `dokploy-network` membership before connecting XPRem. No database backup is configured yet. A previous isolated XPRem 3.2.6 / PostgreSQL 18.6 attempt returned 200 from `/health`, but `/dashboard` returned 503 after only 19 public tables appeared; it did not prove compatibility. Run the full dashboard/database smoke against PostgreSQL 16 before connecting XPRem to the live database. The first deployment is one XPRem replica with its supported local in-process cache, so Redis is not required.

Current live bootstrap, verified through Dokploy on 2026-10-15: project `updates`, environment `production`, the XPRem Compose service, and deployed PostgreSQL 16 service `xprem-control-db` exist. Reuse Dokploy's existing `dokploy-project-backups` Cloudflare R2 destination for XPRem database dumps under the `xprem-control-db/` prefix. Its saved credential appeared in the Dokploy accessibility view during inspection; treat it as exposed, rotate and test it without disrupting any shared use before scheduling backups. The XPRem service is not deployed, and the `updates.mrdemonwolf.com` tunnel route is not verified.

## Do this in order

1. Recreate the private R2 buckets for OTA assets and recovery data.
2. Create separate, bucket-scoped runtime and backup credentials.
3. Configure and verify the retention locks after recreating both buckets.
4. Configure the immutable daily asset copy.
5. Verify `xprem-control-db` shares `dokploy-network` with the XPRem service. Manually rotate and test the exposed `dokploy-project-backups` credential, checking for shared use. Configure PostgreSQL backups in that existing destination with prefix `xprem-control-db/`; copy the exact private connection URL only into the XPRem service after a full isolated dashboard/database smoke passes.
6. Generate and escrow the secrets below.
7. Deploy `compose.dokploy.yml` and serve `updates.mrdemonwolf.com` through the existing Cloudflare Tunnel to private xprem port `3000`.
8. Secure and verify the seeded administrator, then remove the bootstrap login variables.
9. Schedule nightly database backups at 03:00 UTC, keep 30, and prove recovery from both backups.
10. Pass the end-to-end staging smoke before connecting production.

Never put real secrets in `.env.example`, Git, build logs, or a support ticket. Enter them directly in Cloudflare and the narrowest Dokploy service scope. Plain Dokploy Compose variables are persisted in its deployment `.env`; use an already-configured Secrets Provider when available and restrict project access either way.

## 1. Create durable services

Recreate the shared private asset bucket as `mrdemonwolf-ota-assets` in `ENAM`; it was deleted on 2026-10-16. When recreated, configure a 90-day bucket lock across all object prefixes. Product isolation comes from xprem's app records, signing material, and credentials. Create an account-owned R2 S3 API token scoped only to this bucket with **Object Read & Write** (`Workers R2 Storage Bucket Item Write`). Do not grant account-wide R2 administration or make the bucket public; xprem provides signed asset URLs.

Once configured, the [Cloudflare R2 bucket lock](https://developers.cloudflare.com/r2/buckets/bucket-locks/) protects immutable releases from immediate overwrite or deletion by the asset token, so update deletion will intentionally fail until retention expires. It is retention protection, not an independent backup.

Recreate the private asset-backup bucket as `mrdemonwolf-ota-backups` in `ENAM`; it was deleted on 2026-10-16. When recreated, configure a 90-day lock only on the `xprem-assets/` prefix and use it for the immutable OTA asset copy. Scope the asset-copy destination token to this bucket with **Object Read & Write** (`Workers R2 Storage Bucket Item Write`) and its source token to `mrdemonwolf-ota-assets` with **Object Read only** (`Workers R2 Storage Bucket Item Read`). PostgreSQL dumps use Dokploy's existing `dokploy-project-backups` destination under `xprem-control-db/`, keeping its retention separate. The XPRem runtime token must not reach backups, and the asset-copy source token must not mutate live assets.

Dokploy has deployed the standalone PostgreSQL 16 service `xprem-control-db`, matching XPRem's quickstart. Its internal port is 5432 and its external port is blank; verify its membership in external `dokploy-network`. No database backup is configured. A read-only inspection exposed the saved credential for the existing `dokploy-project-backups` R2 destination in the browser accessibility tree; rotate and test it manually after checking whether the same token serves other Dokploy destinations. Use that existing destination for nightly PostgreSQL backups with prefix `xprem-control-db/`, retain 30, and prove a restore. The previous PostgreSQL 18.6 smoke was incomplete: health returned 200, the dashboard returned 503, and only 19 public tables appeared. Copy the exact private connection URL into `DB_URL` only after the complete PostgreSQL 16 dashboard/database smoke passes. Do not guess the internal hostname or TLS mode. If an external database URL is used instead, require TLS.

## 2. Generate and escrow secrets

On a trusted machine, generate two independent values:

```sh
openssl rand -hex 32
openssl rand -base64 32
```

Use them for `JWT_SECRET` and `DB_KEYS_MASTER_KEY_B64`, in that order.

Generate `ADMIN_PASSWORD` separately in a password manager. xprem requires at least eight characters and at least one uppercase letter, lowercase letter, digit, and special character. A hex-only value fails this policy.

`DB_KEYS_MASTER_KEY_B64` protects xprem's stored signing keys. Save the exact value in an encrypted password manager and a separate recovery copy outside Dokploy. Losing both the database and this key can force a new signing certificate and store binary. Do not casually rotate it.

## 3. Deploy in Dokploy

Create a Dokploy Raw Compose application named `xprem` from the exact contents of `infra/xprem/compose.dokploy.yml`. Keep Isolated Deployment off. In Preview Compose, verify its only service is xprem and that it is attached to external `dokploy-network`. The xprem 3.2.6 image is digest-pinned, so a changed upstream tag cannot silently alter the deployment.

Copy the variable names from `.env.example` into Dokploy and replace every placeholder:

| Area | Variables |
| --- | --- |
| Public URL | `BASE_URL=https://updates.mrdemonwolf.com` |
| Database and keys | `DB_URL`, `JWT_SECRET`, `DB_KEYS_MASTER_KEY_B64` |
| Private OTA bucket | `AWS_REGION=auto`, `AWS_BASE_ENDPOINT`, `S3_BUCKET_NAME=mrdemonwolf-ota-assets`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Trusted proxies | `TRUST_PROXY_DEPTH`, set only after verifying the real chain |
| First login only | `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

Serve the public origin through the existing Cloudflare Tunnel:

```text
updates.mrdemonwolf.com -> http://xprem:3000
```

That target works when `cloudflared` also joins external `dokploy-network` and can resolve the `xprem` service name. If the existing tunnel must stay on another private network, attach xprem to that exact external network instead. Do not publish a raw host port, configure the hostname as a Dokploy domain, request a Let's Encrypt certificate, or install an origin certificate for this route. Cloudflare terminates public TLS at the tunnel edge. This runbook does not claim the hostname route is configured; verify it in the existing tunnel before deployment.

`TRUST_PROXY_DEPTH` counts trusted `X-Forwarded-For` hops from the right. A tunnel connected directly to xprem is normally one trusted proxy hop, but set `1` only after inspecting the actual header chain and confirming xprem resolves the public test client's address. Recheck after any tunnel or proxy change because the wrong value weakens login, OAuth, and token-IP rate limiting.


Deploy and wait for xprem to become healthy. It runs read-only with all Linux capabilities dropped and uses `CACHE_MODE=local`, which xprem supports for a single replica. The [cache guide](https://mercure-technologies.gitbook.io/xprem/installation-guide/cache-configuration) recommends Redis for multiple replicas, so add a separate Redis service and change every replica to `CACHE_MODE=redis` before scaling out. Server usage telemetry, device telemetry, and Prometheus are disabled, so ClickHouse is not required.

## 4. Bootstrap once

The first database migration permanently creates the administrator from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; those variables are only bootstrap inputs. Open `https://updates.mrdemonwolf.com/dashboard` and sign in to that seeded account. Then:

1. Change the seeded account's password in the dashboard, or create and verify a second administrator.
2. Sign out and verify the administrator you will keep can sign back in.
3. Remove `ADMIN_EMAIL` and `ADMIN_PASSWORD` from Dokploy and remove their two entries from the live Compose definition.
4. Redeploy and verify the saved administrator login still works.

Create one xprem app record per product, beginning with ConPaws. Never reuse another product's app record. Each product keeps its own:

- app UUID;
- signing certificate and private signing material;
- branches and `staging`/`production` channels;
- publisher token;
- explicit native runtime identifier.

The app UUID is public client configuration, but it must still identify only the intended product. The runtime is a native-compatibility boundary, not a company-wide version. Products may use the same channel names because those channels remain inside their own app records.

Create one publisher token per product only when that product's protected publishing workflow is ready. Store it in that product's protected GitHub environment, never here, and never share it with another app.

## 5. Back up and prove restore

In the Dokploy PostgreSQL service, add an S3-compatible destination using the separate backup bucket and token. Keep its object prefix outside locked `xprem-assets/` so retention can prune database backups. Schedule a backup for `03:00 UTC` every day and retain the newest 30. Run one immediately.

Install `rclone` on the trusted backup runner. Keep a root-owned, mode-`0600` config outside Git and Dokploy logs with two remotes: `xprem-assets` uses the read-only live-bucket token; `xprem-backup` uses the backup-bucket token. Set `no_check_bucket = true` on both remotes because bucket-item tokens cannot list all account buckets. Add a [Dokploy Server Job](https://docs.dokploy.com/docs/core/schedule-jobs) for `03:15 UTC` every day:

```sh
rclone copy --config /etc/mrdemonwolf/xprem-rclone.conf --fast-list --checksum --immutable xprem-assets:mrdemonwolf-ota-assets xprem-backup:mrdemonwolf-ota-backups/xprem-assets
rclone check --config /etc/mrdemonwolf/xprem-rclone.conf --one-way --checksum xprem-assets:mrdemonwolf-ota-assets xprem-backup:mrdemonwolf-ota-backups/xprem-assets
```

Use `copy`, not `sync`: a deletion from the live bucket must not propagate into recovery storage. `--immutable` makes a changed object with an existing key fail the job instead of overwriting the backup. Alert on either command failing.

A green backup job is not enough. Before production:

1. Restore the newest database backup into a disposable PostgreSQL database, never over production.
2. Create a disposable R2 bucket and use separately scoped restore credentials to copy `mrdemonwolf-ota-backups/xprem-assets` into it.
3. Start a disposable xprem instance against the restored database with the escrowed `DB_KEYS_MASTER_KEY_B64`, the disposable asset bucket, and a non-production hostname.
4. Confirm administrator login and every expected product app record, app UUID, channel, branch, runtime, and update record.
5. Run `rclone check` between the backup prefix and disposable bucket, then confirm a restored manifest downloads its launch asset.
6. Record the database backup, asset-copy job, and successful drill date, then delete the disposable restore.

Repeat the drill after a database, storage, or xprem major-version change. A separate Cloudflare account or another S3-compatible provider gives stronger failure isolation; using a second bucket in the same account protects against scoped-token mistakes but retains account-wide and provider-wide risk. Record that accepted MVP risk before launch.

## 6. Smoke before production

The readiness check only proves the process started:

```sh
curl --fail --silent --show-error https://updates.mrdemonwolf.com/ready
```

It does not prove publishing, database metadata, signing, or R2 downloads. The complete staging smoke is:

1. Select one product app UUID and publish once to a unique branch such as `release-0123456789ab` inside that app record.
2. Point only that product's `staging` channel to the exact stored branch.
3. Request `/manifest` with that product's staging app UUID, channel, platform, protocol, and runtime headers; require success.
4. Download its launch asset; require success.
5. Open a staging store-style build online and verify the signed update applies.
6. Relaunch in airplane mode and verify the app works.
7. Make xprem unavailable and verify the embedded app still starts.

Never republish different code to the same release branch. Promote the exact tested branch by repointing `production` inside the same product app record. Begin a production rollout small and advance only after the device checks pass.

## 7. Roll back

For a bad OTA, select the affected product app UUID and repoint its `production` channel to the last known-good stored branch with the same runtime version. Do not rebuild, copy, or republish it.

For an xprem service failure, keep the last known-good Compose revision and digest available. Inspect PostgreSQL and R2 before changing data. Restore metadata into a new database first so the current state remains recoverable.

Each mobile client must retain Expo's embedded-update and anti-bricking protections. Then an unavailable OTA service falls back to a valid embedded or cached app instead of blocking launch.

## 8. Connect agents through MCP

xprem exposes two different MCP endpoints. The public documentation MCP answers xprem questions and works before deployment. The runtime MCP belongs to this deployed control plane and can inspect or mutate every product app the signed-in dashboard user may access.

### Documentation MCP: available now

Add the [xprem documentation MCP](https://mercure-technologies.gitbook.io/xprem/~gitbook/mcp) to Codex:

```sh
codex mcp add xprem-docs --url https://mercure-technologies.gitbook.io/xprem/~gitbook/mcp
codex mcp list
```

This repository already commits `xprem-docs` in `.mcp.json` at Claude project scope; approve that project server when prompted. To use the docs from other repositories, optionally add it at user scope:

```sh
claude mcp add --transport http --scope user xprem-docs https://mercure-technologies.gitbook.io/xprem/~gitbook/mcp
claude mcp list
```

Do not add both scopes under the same name unless you intentionally want the local/project entry to take precedence.

### Runtime control plane: only after deployment

The runtime URL does not exist until xprem is deployed with working HTTPS. After `https://updates.mrdemonwolf.com/ready` and dashboard login succeed, connect Codex:

```sh
codex mcp add mrdemonwolf-xprem --url https://updates.mrdemonwolf.com/mcp
codex mcp login mrdemonwolf-xprem
codex mcp list
```

Connect Claude Code:

```sh
claude mcp add --transport http --scope user mrdemonwolf-xprem https://updates.mrdemonwolf.com/mcp
claude mcp list
```

Then open `/mcp` inside Claude Code and complete the browser OAuth flow. The runtime MCP authenticates as an xprem dashboard user. It does not accept an app publisher token, so never paste or attach one as a bearer token. Publisher tokens belong only in each product's protected publishing environment.

There is one runtime MCP endpoint for the whole control plane, not one endpoint per app. Before an agent changes anything:

1. Call `whoami` and list apps first.
2. Copy the exact intended product app UUID, then read its current branches, channels, runtimes, and rollout state.
3. State the product name, app UUID, runtime, branch, channel, current target, and proposed target.
4. Require explicit human confirmation before a production channel move, rollout change, delete, rollback, republish, or other mutation.
5. Never batch mutations across products. Re-read the affected app after every write and record the result.

Treat an authenticated dashboard administrator as organization-wide access. Logical app isolation reduces mistakes; it does not make an incorrect app UUID safe.

## Small but important notes

- The target 2-vCPU ARM server with 12 GB RAM has comfortable early multi-app headroom. xprem 3.2.6 publishes an ARM64 image, and its [official load results](https://github.com/mercuretechnologies/xprem/tree/main/test/load/results) show much higher request rates on a smaller one-core host. Treat that as evidence, not a capacity guarantee: monitor shared-host CPU, memory, and database latency.
- Upgrade an image only through a reviewed pull request after release notes, an immediate backup, and a restore drill.
- Local cache is process memory and is lost on restart; PostgreSQL and R2 remain the durable sources. Add standalone Redis only before scaling xprem beyond one replica.
- `DISABLE_DEVICE_TELEMETRY=true` prevents new device registry, update-health, and Observe collection. Existing data would require an explicit deletion decision; changing the flag does not purge it.
- `/ready` is not an end-to-end guarantee. Keep manifest, asset-download, signed-device, and airplane-mode checks in every production release checklist.
