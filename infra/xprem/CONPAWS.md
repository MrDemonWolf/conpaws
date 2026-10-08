# ConPaws OTA activation

Next infrastructure task after `dev` and `main` store builds pass. The shared
xprem host remains the planned service; store CI does not deploy it.

- [ ] Deploy the existing descriptor using `infra/xprem/README.md` to the shared
  `updates.mrdemonwolf.com` host. Back up the database and objects and prove a
  restore before treating it as production-ready.
- [ ] Create or identify the ConPaws app record. Record its exact UUID. Give it
  its own signing material, publisher token, branches and channels. Never use
  another product's app UUID or token.
- [ ] Map `dev` builds to a preview channel and `main` builds to production.
  Preview must never publish into the production channel.
- [ ] Install SDK-aligned `expo-updates`, configure the ConPaws update URL,
  signing certificate and runtime policy, and produce new signed binaries.
  Existing binaries without `expo-updates` cannot receive OTA updates.
- [ ] Test signed updates on physical iOS and Android: cold start, offline
  start, wrong runtime rejection and rollback. Include the Watch/widget
  boundary: native changes require new store binaries.
- [ ] Add one publish job to the existing release workflow only after those
  checks pass. Publish JS/assets after CI, scoped to the matching channel and
  compatible runtime. Keep a manual production gate initially.

The source of truth for deployment is the existing runbook and the Notion
**OTA Updates** decision page. Check current xprem and Expo documentation at
implementation time; this checklist does not authorize a version upgrade or
claim the host is deployed.
