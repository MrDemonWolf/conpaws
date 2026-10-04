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

## Production release

Admin has a separate Alchemy program and D1 database. Put deployment values in `packages/infra/.env` or the protected GitHub environment. Before running `bun run deploy:admin`, verify the Cloudflare Access policy. Set `ADMIN_ROUTES_ENABLED=true` only for the approved domain cutover.

Deploying creates or updates Cloudflare resources. Local development and the normal website deploy do not run this command.
