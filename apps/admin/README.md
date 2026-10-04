# ConPaws Admin

This private catalog editor will live at `admin.conpaws.com`. It is a separate Next.js app with its own D1 database and Alchemy deploy command. It shares the repository’s Tailwind styles, UI components, fonts, and workspace tooling.

## Run it locally

1. Copy `.dev.vars.example` to `.dev.vars`; keep the local test email there.
2. Apply the schema: `bun run --filter @conpaws/admin db:migrate:local`.
3. Load the preview fixture: `bun run --filter @conpaws/admin db:seed:local`.
4. Start the app with `bun run dev:admin`, or run the built Worker with `bun run --filter @conpaws/admin preview`.

The local identity bypass works only when the ignored `.dev.vars` file sets `ADMIN_RUNTIME_ENV=local`. The production Alchemy stack always sets `ADMIN_RUNTIME_ENV=production` and never binds `ADMIN_DEV_EMAIL`.

## Preview data

The local seed script reuses the native app’s `ConPaws Preview Con` fixture: a fictional edition with 200 synthetic sessions. It writes generated SQL under the ignored `.wrangler` directory and calls Wrangler in local mode. It is not a migration and never seeds production.

The preview begins as an unpublished draft. Registration is unconfirmed, and no organizer-source check date is set, so the publication checklist blocks publishing it. Names, rooms, and times are made up; the fixture does not imply a real convention, schedule, or organizer partnership.

Production migrations leave the catalog empty. Add real editions only after checking their dates, location, and schedule against an organizer source.

## Access and owner setup

Cloudflare Access must protect all of `admin.conpaws.com` and allow only the owner and approved staff. The app also verifies the `Cf-Access-Jwt-Assertion` signature, issuer, audience, and expiry, then checks each email against `admin_members`. Both checks are required.

Set `ADMIN_OWNER_EMAIL`, `CF_ACCESS_TEAM_DOMAIN`, and `CF_ACCESS_AUD` in the protected deployment environment. On first login, the configured owner email is added only if the database has no owner yet. Owners can then add other owners or editors. Before assigning an app role, add that person to the Cloudflare Access allow policy. The Team screen manages app roles; it does not send invitations or change Access policy.

Keep `ADMIN_ROUTES_ENABLED` off until the Access application and allow policy are ready. The production domain route is disabled by default. Admin pages send `noindex`, and `robots.txt` blocks crawlers.

## Publishing and attendee API

Staff curate convention details and sessions by hand. A publish requires a recent organizer-source check date, valid availability and schedule states, and sessions within the convention dates. It saves an immutable, numbered revision and an audit entry. Organizer URLs, source-check dates, staff identities, and audit records stay private.

Changing a draft leaves the attendee copy untouched. Restoring history copies a prior snapshot into the draft and publishes it as a new revision; existing revisions cannot be edited or removed.

The public `apps/web` Worker serves read-only JSON on `conpaws.com`:

- `GET /api/v1/conventions` lists current published editions.
- `GET /api/v1/conventions/{slug}` returns one published edition.
- `GET /api/v1/conventions/{slug}/schedule` returns its sessions and schedule status.

Each route reads only the snapshot selected by the convention’s current published revision. Drafts, source links, source-check dates, staff identities, and audit records are excluded. Responses may be cached at the edge for 30 seconds. The waitlist database remains separate.

The native app does not download this catalog yet. Offline schedule access, organizer-feed imports, Watch and widget updates, and push or local alerts still need their own implementation and device testing. Cancellations reach attendees only after staff publish a new revision.

## Mobile host experience and PWA direction

**Recommendation: make `admin.conpaws.com` a mobile-first, installable PWA before building a separate host app.** Keep host operations separate from the attendee app so the attendee experience stays focused and host-only editing remains behind its own authorization checks. The admin site is already the right product surface; it needs a deliberate phone workflow, not just a smaller desktop layout.

Current state: the admin console is responsive in a browser, but it is not installable as a PWA yet. A web manifest, app icons, install guidance, and service-worker behavior remain to be built.

Design around convention setup and schedule corrections:

- Put the next setup task first, with clear progress from convention details to schedule review and publication.
- Keep mobile navigation within easy thumb reach and make important controls at least 44 px high.
- Show sessions as compact searchable rows with their local time, room, and status. Expand one edit form at a time instead of showing a page of full forms.
- Keep edits online for the first PWA release. Show save and connection state clearly; never imply a schedule change or publication succeeded while offline.
- Add offline editing only after conflict resolution, local-data protection, and audit behavior are designed and tested. Do not cache authenticated admin pages or private API responses in a general service-worker cache.

Before inviting convention hosts outside the ConPaws team, replace the current global owner/editor access model with tenant-scoped organizations, memberships, convention-level permissions, and an invitation/onboarding flow. Current roles can see the shared catalog; they do not isolate each organizer's conventions.

A future native “ConPaws Hosts” app is possible, but not a launch requirement. Apple App Review guideline 4.2 expects useful app-specific features beyond a repackaged website, and Google Play requires adequate mobile functionality and content. **My reading is that neither policy creates a blanket ban on admin apps; review depends on the actual product.** A native app should wait until host research justifies distinct platform value such as event-day QR check-in, reliable offline operations, or time-sensitive push alerts. Keep the PWA and any later native client on the same catalog API and permission model.

Policy and implementation references, checked October 4, 2026:

- [Apple App Review Guidelines, section 4.2](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play functionality, content, and user experience policy](https://support.google.com/googleplay/android-developer/answer/9898783)
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [WebKit: Web Push for Home Screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Production release

Admin has a separate Alchemy program and D1 database. Put deployment values in `packages/infra/.env` or the protected GitHub environment. Before running `bun run deploy:admin`, verify the Cloudflare Access policy. Set `ADMIN_ROUTES_ENABLED=true` only for the approved domain cutover.

Deploying creates or updates Cloudflare resources. Local development and the normal website deploy do not run this command.

Deploy and migrate the admin stack before enabling the public catalog binding.
Set the existing catalog D1 UUID as the `CATALOG_DATABASE_ID` repository variable
(or local Alchemy environment value), then deploy the website. The website binds
that database by ID and does not create, migrate or delete it. Leaving the value
unset keeps catalog endpoints unavailable while the existing website and waitlist
continue to work.
