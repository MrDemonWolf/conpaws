# MrDemonWolf, Inc. self-hosted OTA control plane

This deploys one shared [xprem](https://github.com/mercuretechnologies/xprem) 3.1.1 control plane for MrDemonWolf, Inc. on Dokploy. It can serve ConPaws and future Expo apps. Deploying it alone does not enable any client or publish an update.

Durable metadata lives in a separate Dokploy PostgreSQL service, while one private Cloudflare R2 asset bucket serves all product app records. Redis is disposable cache.

## Do this in order

1. Create private R2 buckets for OTA assets and recovery data.
2. Create separate, bucket-scoped runtime and backup credentials.
3. Add retention locks to the live assets and backed-up asset prefix.
4. Configure the immutable daily asset copy.
5. Create a Dokploy PostgreSQL Database service.
6. Generate and escrow the secrets below.
7. Deploy `compose.dokploy.yml` and route `updates.mrdemonwolf.com` to port `3000`.
8. Secure and verify the seeded administrator, then remove the bootstrap login variables.
9. Schedule nightly database backups at 03:00 UTC, keep 30, and prove recovery from both backups.
10. Pass the end-to-end staging smoke before connecting production.

Never put real secrets in `.env.example`, Git, build logs, or a support ticket. Enter them directly in Dokploy and Cloudflare.

## 1. Create durable services

In Cloudflare R2, create one private asset bucket shared by all product app records. The example name is `mrdemonwolf-ota-assets`. Product isolation comes from xprem's app records, signing material, and credentials. Create an S3 API token scoped only to this bucket with object read and write access. Do not make the bucket public; xprem provides signed asset URLs.

Before the first publish, add a [Cloudflare R2 bucket lock](https://developers.cloudflare.com/r2/buckets/bucket-locks/) with no prefix and 90-day retention. This protects immutable releases from immediate overwrite or deletion by the asset token, so update deletion will intentionally fail until retention expires. It is retention protection, not an independent backup.

Create a second private R2 bucket named like `mrdemonwolf-ota-backups` for PostgreSQL backups and an immutable copy under `xprem-assets/`. Give the backup destination a different token scoped only to that bucket, and give the backup runner a read-only source token for the live asset bucket. The xprem runtime token must not reach backups, and the backup source token must not mutate live assets. Add a 90-day bucket lock only to the backup bucket's `xprem-assets/` prefix so database-backup retention can still prune old files.

In Dokploy, create a PostgreSQL Database service for xprem. Copy its exact private connection URL into `DB_URL`. Do not guess the internal hostname or TLS mode. If an external database URL is used instead, require TLS.

## 2. Generate and escrow secrets

On a trusted machine, generate three independent values:

```sh
openssl rand -hex 32
openssl rand -base64 32
openssl rand -hex 32
```

Use them for `JWT_SECRET`, `DB_KEYS_MASTER_KEY_B64`, and `REDIS_PASSWORD`, in that order.

Generate `ADMIN_PASSWORD` separately in a password manager. xprem requires at least eight characters and at least one uppercase letter, lowercase letter, digit, and special character. A hex-only value fails this policy.

`DB_KEYS_MASTER_KEY_B64` protects xprem's stored signing keys. Save the exact value in an encrypted password manager and a separate recovery copy outside Dokploy. Losing both the database and this key can force a new signing certificate and store binary. Do not casually rotate it.

## 3. Deploy in Dokploy

Create a Dokploy Compose application from `infra/xprem/compose.dokploy.yml`. Its xprem 3.1.1 and Redis 7.4.10 images are digest-pinned, so a changed upstream tag cannot silently alter the deployment.

Copy the variable names from `.env.example` into Dokploy and replace every placeholder:

| Area | Variables |
| --- | --- |
| Public URL | `BASE_URL=https://updates.mrdemonwolf.com` |
| Database and keys | `DB_URL`, `JWT_SECRET`, `DB_KEYS_MASTER_KEY_B64` |
| Private OTA bucket | `AWS_REGION=auto`, `AWS_BASE_ENDPOINT`, `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| Disposable cache | `REDIS_PASSWORD`, optionally `CACHE_KEY_PREFIX` |
| Trusted proxies | `TRUST_PROXY_DEPTH`, set only after verifying the real chain |
| First login only | `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

Attach the organization-owned `updates.mrdemonwolf.com` hostname to the `xprem` service on container port `3000`. Do not publish a raw host port. Enable HTTPS and redirect HTTP to HTTPS. If Cloudflare proxies the hostname, use strict origin certificate validation.
`TRUST_PROXY_DEPTH` counts trusted `X-Forwarded-For` hops from the right. Use `1` only when Dokploy/Traefik is the sole proxy. Cloudflare in front of Traefik is typically `2`, but do not copy that value blindly: inspect the actual header chain, confirm xprem resolves the public test client's address, and then set the exact count. Recheck after any CDN or proxy change because the wrong value weakens login, OAuth, and token-IP rate limiting.


Deploy and wait for both containers to become healthy. xprem runs read-only with all Linux capabilities dropped. Redis runs as UID/GID `999:1000`, read-only, with a bounded in-memory data directory and no durable volume. Device telemetry and Prometheus are disabled.

## 4. Bootstrap once

The first database migration permanently creates the administrator from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; those variables are only bootstrap inputs. Open `https://updates.mrdemonwolf.com` and sign in to that seeded account. Then:

1. Change the seeded account's password in the dashboard, or create and verify a second administrator.
2. Sign out and verify the administrator you will keep can sign back in.
3. Remove `ADMIN_EMAIL` and `ADMIN_PASSWORD` from Dokploy.
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

In the Dokploy PostgreSQL service, add an S3-compatible destination using the separate backup bucket and token. Schedule a backup for `03:00 UTC` every day and retain the newest 30. Run one immediately.

Install `rclone` on the trusted backup runner. Keep a root-owned, mode-`0600` config outside Git and Dokploy logs with two remotes: `xprem-assets` uses the read-only live-bucket token; `xprem-backup` uses the backup-bucket token. Add a [Dokploy Server Job](https://docs.dokploy.com/docs/core/schedule-jobs) for `03:15 UTC` every day:

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

- The target 2-vCPU ARM server with 12 GB RAM has comfortable early multi-app headroom. xprem 3.1.1 publishes an ARM64 image, and its [official load results](https://github.com/mercuretechnologies/xprem/tree/main/test/load/results) show much higher request rates on a smaller one-core host. Treat that as evidence, not a capacity guarantee: monitor shared-host CPU, memory, and database latency.
- Upgrade an image only through a reviewed pull request after release notes, an immediate backup, and a restore drill.
- Redis is cache only. Restarting it must not lose branches, channel mappings, signing keys, or assets.
- Disabled telemetry does not mean zero client metadata. xprem can transiently cache raw EAS client identifiers in Redis for about four hours. Keep Redis private and ephemeral, and include this in the privacy review.
- `/ready` is not an end-to-end guarantee. Keep manifest, asset-download, signed-device, and airplane-mode checks in every production release checklist.
