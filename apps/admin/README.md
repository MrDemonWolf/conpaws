# ConPaws Admin

This private catalog editor lives at `admin.conpaws.com`. It is a separate Next.js app and Worker that deploys with the rest of the stack and shares the catalog database with the public API. It shares the repository’s Tailwind styles, UI components, fonts, and workspace tooling.

## Run it locally

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Apply the schema: `bun run --filter @conpaws/admin db:migrate:local`.
3. Load the preview fixture: `bun run --filter @conpaws/admin db:seed:local`.
4. Start the app with `bun run dev:admin`, or run the built Worker with `bun run --filter @conpaws/admin preview`.

With `ADMIN_DEV_EMAIL` set, you skip sign-in and act as that address; on a local catalog with no owner yet, it becomes the owner. Remove it to try the real sign-in: invite yourself with `bun run admin:invite -- you@example.com --local`, open `/sign-in`, and read the code from the dev server log. Local email is never delivered.

Both shortcuts need `ADMIN_RUNTIME_ENV=local`, which only the ignored `.dev.vars` file sets. The production deploy always binds `ADMIN_RUNTIME_ENV=production` and never binds `ADMIN_DEV_EMAIL`.

## Preview data

The local seed script reuses the native app’s `ConPaws Preview Con` fixture: a fictional edition with 200 synthetic sessions. It writes generated SQL under the ignored `.wrangler` directory and calls Wrangler in local mode. It is not a migration and never seeds production.

The preview begins as an unpublished draft. Registration is unconfirmed, and no organizer-source check date is set, so the publication checklist blocks publishing it. Names, rooms, and times are made up; the fixture does not imply a real convention, schedule, or organizer partnership.

Production migrations leave the catalog empty. Add real editions only after checking their dates, location, and schedule against an organizer source.

## Signing in and the team

There is no password and no Cloudflare Access in front of the console. Staff sign in with an 8-digit code sent to their email:

1. Enter an email address on `/sign-in`.
2. If that address is on the team, or has an unexpired invite, ConPaws emails a code.
3. Enter the code in the same browser. It expires after 10 minutes and allows 5 tries.

Neither step reveals who is on the team. The request page looks the same for every address, and every failed code gets the same message, whether it was wrong, used up, expired, or never sent.

A session lasts 7 days. If it has ended, the console sends you to sign in and then back to the page you asked for. The account menu has **Sign out** and **Sign out on all devices**; the second reports success only once the server confirms every session ended.

**Owners invite people on the Team screen.** An invite emails a sign-in link and lasts 7 days. The person becomes a member, with the role chosen in the invite, the first time they enter a code. The link fills in their address from the part after `#`, which browsers never send to the server, so addresses stay out of request logs. It is safe to copy into a chat: they still need the code we email them. Pending invites can be resent or withdrawn.

Inviting, changing roles and turning access off need a code entered in the last two hours. If yours is older, the Team screen asks you to confirm with a fresh code first. Turning someone's access off signs them out everywhere at once. An invite never re-enables an account that was turned off.

**The first owner is invited from your own machine**, because nobody can claim an empty console by visiting it first:

```bash
bun run admin:invite -- you@example.com
```

The command writes the invite to the production catalog with your Wrangler login, or with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. If your login covers more than one Cloudflare account, set `CLOUDFLARE_ACCOUNT_ID` as well, because the command cannot show Wrangler's account picker. The role defaults to owner; pass `--role editor` otherwise. It refuses to run in CI, because the repository's logs are public. Use the same command if every owner loses access.

**Limits:** from any one network, an address gets at most one code a minute, five an hour and ten a day, and fifty a day across all networks. Counting per network means someone elsewhere cannot use up a member's allowance. A browser already signed in as that member, confirming before a team change, is held only to its own once-a-minute limit. The limits are checked inside the database write, so parallel requests cannot slip past them. A coarse per-network limit also sits in front of both forms. Networks are stored only as a keyed hash, codes only as an HMAC bound to the browser that asked for them, and sessions only as a SHA-256 of the cookie token. Sign-ins, invites and role changes appear on the Activity screen. Admin pages send `noindex`, and `robots.txt` blocks crawlers.

Passkeys are the planned next step, before any outside host is invited.

## Publishing and attendee API

Staff curate convention details and sessions by hand. A publish requires a recent organizer-source check date, valid availability and schedule states, and sessions within the convention dates. It saves an immutable, numbered revision and an audit entry. Organizer URLs, source-check dates, staff identities, and audit records stay private.

Changing a draft leaves the attendee copy untouched. Restoring history copies a prior snapshot into the draft and publishes it as a new revision; existing revisions cannot be edited or removed.

The public `apps/api` Worker serves read-only JSON on `api.conpaws.com`:

- `GET /v1/conventions` lists current published editions.
- `GET /v1/conventions/{slug}` returns one published edition.
- `GET /v1/conventions/{slug}/schedule` returns its sessions and schedule status.

Each route reads only the snapshot selected by the convention’s current published revision. Drafts, source links, source-check dates, staff identities, and audit records are excluded. Responses may be cached at the edge for 30 seconds. The waitlist database remains separate.

The native app downloads this catalog through Find my convention and keeps the edition's slug and revision so a later check can update it in place. Cancellations reach attendees only after staff publish a new revision.

## Mobile host experience and PWA direction

**Recommendation: make `admin.conpaws.com` a mobile-first, installable PWA before building a separate host app.** Keep host operations separate from the attendee app so the attendee experience stays focused and host-only editing remains behind its own authorization checks. The admin site is already the right product surface; it needs a deliberate phone workflow, not just a smaller desktop layout.

The admin console is an installable PWA with a home-screen manifest, branded icons, browser-aware install guidance, and a cached offline fallback page. Phone and tablet layouts keep navigation within reach, respect display safe areas, and provide a visible connection warning.

Design around convention setup and schedule corrections:

- Put the next setup task first, with clear progress from convention details to schedule review and publication.
- Keep mobile navigation within easy thumb reach and make important controls at least 44 px high.
- Show sessions as compact searchable rows with their local time, room, and status. Expand one edit form at a time instead of showing a page of full forms.
- Keep edits online for the first PWA release. Offline form submissions are blocked and explain that the host should reconnect and submit again; the PWA never implies a schedule change or publication succeeded while offline.
- The service worker caches only the public offline fallback page, manifest, and public app icons. It does not cache authenticated admin pages, form data, or private API responses.
- Add offline editing only after conflict resolution, local-data protection, and audit behavior are designed and tested.

Before inviting convention hosts outside the ConPaws team, replace the current global owner/editor access model with tenant-scoped organizations, memberships, convention-level permissions, and an invitation/onboarding flow. Current roles can see the shared catalog; they do not isolate each organizer's conventions.

A future native “ConPaws Hosts” app is possible, but not a launch requirement. Apple App Review guideline 4.2 expects useful app-specific features beyond a repackaged website, and Google Play requires adequate mobile functionality and content. **My reading is that neither policy creates a blanket ban on admin apps; review depends on the actual product.** A native app should wait until host research justifies distinct platform value such as event-day QR check-in, reliable offline operations, or time-sensitive push alerts. Keep the PWA and any later native client on the same catalog API and permission model.

Policy and implementation references, checked October 4, 2026:

- [Apple App Review Guidelines, section 4.2](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play functionality, content, and user experience policy](https://support.google.com/googleplay/android-developer/answer/9898783)
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [WebKit: Web Push for Home Screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Production release

The admin console deploys with the rest of the stack: `bun run deploy` locally, or the `Deploy web` workflow after CI passes on `main`. There is no separate admin program, workflow, or setting.

The catalog database is created by the same deploy, empty, with these migrations applied, and bound to both this console and the public API at api.conpaws.com. Nothing needs its ID. Until staff publish an edition, the API answers an empty list.

The deploy also derives the key that protects stored sign-in codes from `ALCHEMY_PASSWORD`, so there is no secret to set. Keep `ALCHEMY_PASSWORD` identical on every machine and in CI that deploys production; a mismatch only breaks codes sent in the minutes around a deploy. Two one-time steps finish the setup:

1. **Turn on email sending for conpaws.com.** In the Cloudflare dashboard, go to Compute, then Email Service, then Email Sending, and choose Onboard Domain for `conpaws.com`. Cloudflare adds the SPF, DKIM, DMARC and bounce records itself. Codes come from `admin@conpaws.com`. Until this is done the console loads, but codes do not arrive and the Worker logs a sender error such as `E_SENDER_DOMAIN_NOT_AVAILABLE` or `E_SENDER_NOT_VERIFIED`.
2. **Invite the first owner** with `bun run admin:invite -- you@example.com`, then sign in at https://admin.conpaws.com/sign-in.

Do not invite outside hosts until organization isolation exists; today every role sees the whole catalog.
