# OTA updates: implementation and launch gate

## Decision now

OTA updates are **required for the MVP**. The selected service is signed
[xprem 3.1.1](https://github.com/mercuretechnologies/xprem), self-hosted on
Dokploy. ConPaws will not use EAS Update.

The feature remains fail-closed while it is built. The Expo SDK 57 app has no
`expo-updates` dependency, `updates.url`, `runtimeVersion`, or update channels,
and no xprem service has been deployed yet. Do not enable production OTA until
signed xprem staging is available and physical iOS and Android devices pass
downloaded-update cold-start, offline-start, and rollback tests.

The configured update URL is embedded in each store binary, so use a long-lived
hostname and prove the staging topology before making a production binary.

**Release path while the OTA gate is closed:** CI passes -> make a signed store
build -> test it in TestFlight and Play Internal Testing -> release that exact
build manually.

## Historical blocker: SDK 55 Android startup deadlock

**Do not enable `expo-updates` in ConPaws on Expo SDK 55.**

As of 2026-08-17, [Expo issue #47920](https://github.com/expo/expo/issues/47920) is open and awaiting review. It reports that an Android app launching a downloaded update can permanently deadlock before React starts, leaving the user on a frozen splash screen until reinstall. The reproduction uses `expo-modules-core` 55.0.17 and `expo-updates` 55.0.20. The issue says the queue implementation is fixed on SDK 56 `main`, but no SDK 55 backport has landed.

This is a client-side `expo-updates`/`expo-modules-core` risk. Changing the server does not remove it: xprem, Xavia, OTAShip, EAS Update, and any other server using the standard Expo Updates client all reach the same native startup path.

ConPaws now uses SDK 57 with Expo `~57.0.14`, so the affected SDK 55 client is
no longer in the repository. It must still remain store-build-only until signed
store-style clients pass the targeted downloaded-update cold-start regression
plus the full release smoke test on physical iOS and Android devices.

[Hot Updater](https://github.com/gronxb/hot-updater) and [Codemagic Patch](https://github.com/codemagic-ci-cd/codemagic-patch) use their own native update clients, so this exact `expo-updates` queue defect does not apply to them. They are not a quick workaround: either choice changes the native client, update/runtime model, security boundary, release tooling, and future migration path. Treat both as research candidates, not the current recommendation.

## Options

| Option | Fit now | Cost and work | Verdict |
| --- | --- | --- | --- |
| Store builds only | Safe temporary path while the OTA gate is closed | More build/store turnaround; almost no OTA operations | **Use until staging passes** |
| Self-host [xprem 3.1.1](https://github.com/mercuretechnologies/xprem) on Dokploy | Selected MVP OTA path | We operate the service, storage, backups, signing, monitoring, and recovery | **Chosen; setup not completed** |
| EAS Update | Managed alternative | Usage limits and pricing do not match this project | **Do not use** |
| Community Vercel server | Easy-looking deployment | Too little production evidence; the candidate below lacks signing | Do not use for production |

### Selected self-hosted shape

Build the signed xprem 3.1.1 staging deployment on Dokploy with:

- a dedicated hostname such as `updates.conpaws.com`;
- xprem's Docker image;
- Cloudflare R2 or another S3-compatible bucket for immutable bundles and assets;
- PostgreSQL when we want the dashboard, channels, progressive rollouts, and control-plane history;
- separate staging and production publishing credentials;
- update code signing, health checks, logs, Prometheus metrics, and tested backups.

xprem implements the official [Expo Updates protocol](https://docs.expo.dev/technical-specs/expo-updates-1/), supports Docker, R2/S3 storage, signing, channels, staged rollouts, and rollback/republish operations. It is an independent open-core project, not Expo-supported software. Its update pipeline and core rollout tooling are MIT, while RBAC, SSO, and branch protection are commercial features. We must review its license boundary and security model before production.

[Dokploy supports Docker Compose](https://docs.dokploy.com/docs/core/docker-compose), service monitoring, logs, persistent named volumes, and backups. That makes it a reasonable host, but Dokploy does not remove our responsibility for database recovery, secret rotation, TLS, capacity, or incident response.

Previously evaluated alternatives include [Xavia OTA](https://github.com/xavia-io/xavia-ota) and [OTAShip](https://github.com/vknow360/otaship). They are fallback research candidates, not parallel MVP implementations.

### Why not Vercel right now?

[outsung/custom-expo-updates-server](https://github.com/outsung/custom-expo-updates-server) is a Next.js server that can deploy to Vercel and use Vercel Blob. Its own README also says update signing is not implemented and `eas update` cannot publish to it. The repository is small and makes no production-readiness claim. It can be a disposable experiment, not the server embedded in a public ConPaws binary.

Xavia is also built with Next.js, but its documented production path is Docker/Docker Compose. Do not assume Vercel compatibility without a maintained deployment guide and a complete signing test.

Expo's [custom update server repository](https://github.com/expo/custom-expo-updates-server) is a protocol demonstration. Expo explicitly says it is not guaranteed to be complete, stable, or performant enough for a full backend. Never deploy that demo as production infrastructure.

### Why not EAS Update?

EAS Update is not part of the ConPaws OTA path. Its managed hosting and rollout
features are useful as a comparison, but its usage limits and pricing are the
reason this project selected xprem on Dokploy. EAS Build may still create signed
store artifacts; using EAS Build does not require using EAS Update.

## Non-negotiable release rules

Every OTA publish must follow these rules:

1. CI must pass before publishing anything.
2. Publish an immutable update to `staging` first.
3. Test that exact update on physical iOS and Android store-style builds, including cold starts, offline starts, database upgrades, reminders, and rollback.
4. Promote or republish the exact tested artifact to production. Do not rebuild JavaScript from a different checkout.
5. Start with a small deterministic rollout, observe crash/startup health, then increase it deliberately.
6. Keep the prior known-good update immediately republishable. Practice rollback before launch.
7. Record the Git commit, update ID/content hash, runtime version, publisher, rollout percentage, and test result.

An OTA rollback changes the JavaScript bundle; it does **not** undo a SQLite migration. Database changes must use expand/contract sequencing:

- first add new tables/columns while old code still works;
- then ship code that can read both old and new shapes;
- backfill safely and idempotently;
- only remove old data in a later store release, after old runtimes can no longer receive updates.

## Runtime and signing rules

Set an explicit manual runtime identifier when the SDK 57 staging client is configured:

```json
{
  "runtimeVersion": "1.0.0-r1"
}
```

The runtime identifier tracks native compatibility independently of the public app version and internal store build counters. Bump it for every native-module, config-plugin, native configuration, entitlement or permission, or Expo SDK change. Follow Expo documentation for [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), and never send an update to a binary whose native modules cannot run it.

TestFlight and Play build numbers may vary while binaries share one runtime when their native compatibility shape is unchanged. A runtime bump does not require a public version bump. Any native, plugin, configuration, permission, or SDK change still requires a new signed store binary; OTA is only for compatible JavaScript and assets.

Enable end-to-end update signing before production. The certificate belongs in the app binary; the private key stays outside Git, in a secrets manager with restricted production access and a documented rotation/recovery plan. Expo documents the client-side model in its [code-signing guide](https://docs.expo.dev/eas-update/code-signing/). A self-hosted server must produce responses that the standard `expo-updates` client can verify.

## Notifications are separate

OTA hosting does not control notifications.

- Existing local reminders continue to use `expo-notifications` and the device OS.
- Expo's push notification service can be evaluated later without adopting EAS Update.
- Moving OTA bundles to Dokploy does not require moving notification delivery there.

## Go/no-go checklist

Production OTA stays disabled until all boxes are checked. A staging-only
client may be configured after the direct SDK 57 upgrade and the signed staging
endpoint are ready.

- [x] Self-hosted project, version, and host selected: xprem 3.1.1 on Dokploy.
- [x] EAS Update excluded from the implementation path.
- [x] Upgrade directly from Expo SDK 55 to SDK 57 with Expo `>=57.0.9`; do not land SDK 56.
- [ ] Deploy xprem 3.1.1 to staging with a pinned image reference, PostgreSQL, object storage, TLS, and health checks.
- [ ] Record the exact iOS and Android client package versions.
- [ ] Staging and production channels cannot be confused accidentally.
- [ ] Production publishing credentials are unavailable to pull-request CI.
- [ ] Update signing succeeds on physical iOS and Android release builds.
- [ ] Downloaded updates pass cold starts and offline starts on physical iOS and Android devices.
- [ ] A bad update is rejected or rolled back without bricking cold or offline launch.
- [ ] Staged rollout, pause, republish, and rollback are rehearsed.
- [ ] PostgreSQL and object-storage backup/restore are tested.
- [ ] Health, latency, disk/storage, certificate expiry, and failed publishes alert someone.
- [ ] Database migrations follow expand/contract rules.
- [ ] The public hostname and TLS ownership are expected to outlive the current server.

## Inputs still needed for setup

The product, version, and host decisions are complete. Setup still needs:

1. The long-lived OTA hostname, recommended as `updates.conpaws.com`, and the target Dokploy server/region.
2. The PostgreSQL database and R2/S3 bucket, region, endpoint, and backup destinations.
3. The staging and production publisher identities and where their credentials are stored.
4. The signing-key custodian, restricted production access, rotation plan, and encrypted recovery copy.
5. The TestFlight and Play Internal Testing devices/testers used for staging approval.
6. The destination for health, latency, storage, certificate-expiry, backup, and failed-publish alerts.

Do not paste signing keys, tokens, or store credentials into chat. We can configure secret names and access boundaries after those choices are made.
