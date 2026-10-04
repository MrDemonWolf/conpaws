# ConPaws: project context, resource estimate, and convention research

Research date: October 2, 2026, America/Chicago.
Purpose: upload this file to a normal ChatGPT conversation for planning and convention research. This is a dated snapshot, not a live data feed or an exhaustive convention directory.

## Project context

ConPaws is a furry convention companion app with a Next.js public website at conpaws.com. The mobile app is local-first: it imports schedules from Sched or calendar feeds and keeps core schedule use on the device.

Current direction agreed with Nathanial:

- Keep the existing Next.js website on Cloudflare Workers.
- Improve product marketing and SEO, retain all 23 website languages, and support a waitlist/coming-soon mode followed by a live/download mode.
- Use files for marketing content, changelog, FAQs, and help unless a concrete editing need warrants a CMS.
- Keep the EmDash/Astro experiment isolated. It has not replaced production.
- Plan admin.conpaws.com for convention catalog management. This dashboard is still a plan/prototype, not a completed production service.
- Another active Codex task, Research Apple assets and redesign, owns mobile UX prototypes and admin planning. Do not mistake prototype screens for shipped features.
- Nathanial prefers simple Cloudflare infrastructure, minimal recurring costs, and portable data. A single Worker is his preferred management direction; final routing/deployment design remains to be implemented.

Current production infrastructure is defined in packages/infra/alchemy.run.ts. It includes the public site, waitlist D1 data, and an hourly reconciliation Worker. Therefore the current deployment is not already a single Worker. Waitlist consent records must remain intact.

Do not describe any convention as a ConPaws partner or supported import source without verification. A researched convention is a catalog candidate, not proof of compatibility or endorsement.

## Estimated Cloudflare resources

These are planning assumptions, not measured usage, a benchmark, or an account billing forecast. Other projects share the account's included quotas. Account plan and existing consumption have not been checked in this research pass.

Suggested data path:

1. Editors make authenticated changes in the admin dashboard.
2. D1 stores catalog records and editorial metadata.
3. Publishing produces a versioned catalog/schedule snapshot for cached public downloads.
4. The mobile app keeps its downloaded copy locally and checks for changes at bounded intervals or on user refresh.

Cache public data; do not publicly cache authenticated admin responses or waitlist writes. Cached API responses can still count as Worker invocations. Static assets are free only when served through the static asset path without invoking Worker code.

### Monthly request and CPU model

Assume two dynamic requests per website page view, four catalog checks per active app user per day for 30 days, and average CPU of 10 ms per dynamic request. App users in this model are active every day; this is deliberately more demanding than occasional convention use. Include cache-hit invocations in the request count. CPU is an unmeasured allowance, not a promise about Next.js rendering.

| Scenario | Website page views | Active app users | Admin requests | Dynamic requests | CPU allowance | Workers-only estimate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Early use | 10,000 | 1,000 | 5,000 | 145,000 | 1.45 million ms | $5/month |
| Growing | 100,000 | 10,000 | 10,000 | 1.41 million | 14.1 million ms | $5/month |
| Larger | 1 million | 100,000 | 50,000 | 14.05 million | 140.5 million ms | About $8.43/month |

The larger scenario arithmetic is $5 + (4.05 x $0.30) + (110.5 x $0.02) = $8.425. These figures exclude D1/R2 overages, email, AI APIs, build charges where applicable, paid add-ons, taxes, and other account usage. If average CPU were 100 ms instead of 10 ms, the growing scenario would be about $7.22/month for Workers. Measure actual CPU before treating this as a budget.

Workers Paid starts at $5/month with 10 million requests and 30 million CPU-ms included. Overages are $0.30/million requests and $0.02/million CPU-ms. The subscription is account-level, not $5 per Worker. [Official Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

### Storage and database model

- Catalog only: 100 conventions at approximately 10 KB each is roughly 1 MB of raw records.
- Optional hosted schedules: 100 conventions x 1,000 events x 1 KB per event is roughly 100 MB before indexes, revisions, and backups. Allow approximately 0.5-1 GB for an initial database with history; actual descriptions and retention determine the result.
- Logos, maps, and published files: initially allow 1-5 GB of R2 Standard storage. Large maps, images, and retained old editions can dominate storage.
- D1 reads depend on rows scanned, not just HTTP requests. Indexed lookups and reusable published snapshots keep public traffic from repeatedly scanning every event. No defensible row-read forecast exists until the query design is implemented.
- D1 Paid includes 25 billion rows read/month, 50 million rows written/month, and 5 GB storage. [Official D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
- R2 Standard includes 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations/month; internet egress is free. [Official R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Practical expectation: the site, a small editor team, catalog API, and modest app traffic should remain within the $5 Workers subscription and included D1/R2 usage under these assumptions. If Workers Paid is already enabled and account allowances remain available, incremental cost may be near $0. A Pages plan or zone subscription alone does not confirm Workers Paid entitlement. Continuous AI ingestion, social feeds, user media, chat, or cloud sync need a separate estimate if added.

## Upcoming convention candidates

Dates are inclusive local calendar dates, not UTC timestamps. All rows were researched on October 2, 2026 from official organizer sources. Unknown fields remain unknown. This is a seven-event starter set across the US and Germany.

| Event / edition | Start | End | Location / venue | Primary source |
| --- | --- | --- | --- | --- |
| Midwest FurFest 2026 | 2026-12-03 | 2026-12-06 | Rosemont, Illinois, USA; specific venue details should be checked on the hotels page | [Official homepage](https://www.furfest.org/) |
| New Year's Furry Festival 2026-2027 | 2026-12-30 | 2027-01-01 | Courtland Grand Hotel, Atlanta, Georgia, USA | [Official event site](https://newyearsfurryfestival.com/) and [FWA announcement on homepage](https://furryweekend.com/) |
| Further Confusion 2027 | 2027-01-14 | 2027-01-18 | San Jose Convention Center, San Jose, California, USA | [Official homepage](https://furtherconfusion.org/) |
| Furry Weekend Atlanta 2027 | 2027-05-06 | 2027-05-09 | Atlanta, Georgia, USA; multiple partner hotels | [Official homepage](https://furryweekend.com/) and [hotels](https://furryweekend.com/hotels/) |
| Anthrocon 2027 | 2027-07-01 | 2027-07-04 | David L. Lawrence Convention Center, Pittsburgh, Pennsylvania, USA | [Official homepage](https://www.anthrocon.org/) and [about/location](https://www.anthrocon.org/about/) |
| Eurofurence 31 / 2027 | 2027-08-18 | 2027-08-22 | CCH Hamburg, Hamburg, Germany | [Official edition homepage](https://www.eurofurence.org/EF31/home) |
| Megaplex 2027 | 2027-08-20 | 2027-08-22 | 2027 venue not verified in this pass; do not inherit the previous venue automatically | [Organizer future convention dates](https://www.megaplexcon.org/fun/events/) |

### Edition-specific notes

#### Midwest FurFest 2026

- Theme: Bark to the Future.
- The homepage links registration and the room block as open at research time.
- Programming submission labels may lag behind announcements; recheck individual pages before giving deadlines.
- Schedule feed, export URL, current panels, and ConPaws import compatibility: not verified.

#### New Year's Furry Festival 2026-2027

- Presented by Furry Weekend Atlanta, but a distinct event from FWA 2027.
- Official FWA announcement describes it as a 21+ event.
- Model the date range across two years rather than truncating it at December 31.
- Schedule feed and import compatibility: not verified.

#### Further Confusion 2027

- Theme: FC Land - The Wildest Ride in The Fandom.
- The official homepage gives the venue address as 150 W San Carlos St, San Jose, CA 95113.
- [Schedule page](https://furtherconfusion.org/programming/schedule/) still contains references to the 2026 edition despite the current site branding. Treat its listed sessions as previous-edition material until confirmed.
- A public schedule page does not prove an accessible Sched or ICS export. Feed URL and import compatibility: not verified.

#### Furry Weekend Atlanta 2027

- Homepage states registration is open at research time.
- The hotel page says the 2027 room block opens October 30, 2026. Hotel prices and inventory should be researched again before travel advice.
- Partner hotels include Marriott Marquis, Hyatt Regency, Hilton, Courtland Grand, Westin, and Aloft Atlanta Downtown.
- Feed URL, 2027 program, and import compatibility: not verified.

#### Anthrocon 2027

- Theme shown in current official site title: LEVEL 30: BEGIN.
- [October 1, 2026 announcement](https://www.anthrocon.org/news/anthrocon-2027-ready-set-game-on/) says pre-registration opens October 20, 2026 at approximately 8 PM EDT; event applications are planned to open in November.
- [Registration page](https://www.anthrocon.org/registration/) still explicitly presents 2026 information and says 2027 details will be added. Use the newer dated announcement for the opening date; do not reuse its old prices, inventory, or deadlines.
- Feed URL, full 2027 program, and import compatibility: not verified.

#### Eurofurence 31

- Theme: Midnight at the Lab.
- EF30 / 2026 pages and its past pretalx event remain searchable. Keep those separate from EF31.
- Feed URL, 2027 schedule platform, and import compatibility: not verified. Do not assume a previous edition's platform is unchanged.

#### Megaplex 2027

- The organizer's events page lists August 20-22, 2027 under future conventions.
- That same page still prominently contains 2026 programming. Treat those panels and application deadlines as historical, not 2027 data.
- 2027 theme, venue, registration status, feed URL, and import compatibility: not verified.

## Minimal catalog fields for later admin work

Use a stable convention identity plus separate annual editions. Suggested fields, not an implemented database schema:

- Convention slug/name and edition year/name.
- Start/end local dates and verified IANA timezone.
- City, country, venue; leave unverified values empty.
- Official site, source URL for each fact, and last-verified date.
- Schedule platform, actual feed URL, and feed-validation status.
- Draft/published/archived state, and last-published revision.
- Age restriction where officially stated.

Keep editorial verification separate from publication status. An event with confirmed dates can be published without claiming its schedule is importable. Do not scrape full panel descriptions or copy organizer artwork merely because a page is public.

## Prompt to paste into ChatGPT with this file

> Use the attached file as dated ConPaws context. Help me research upcoming furry conventions and plan a simple convention catalog/admin workflow. If browsing is available, refresh facts from official organizer websites and dated announcements before calling them current. Separate editions, keep unknown fields empty, and include source URLs plus verification dates. Never invent attendance, partnerships, deadlines, venue changes, schedule feed URLs, or ConPaws compatibility. For each candidate, give its edition, dates, location, official site, schedule source if actually verified, and remaining research tasks. Keep marketing content file-based and core app behavior local-first unless I request a change.

## Refresh checklist

- [ ] Recheck organizer announcements, edition pages, registration, and hotel pages.
- [ ] Resolve inconsistent years before importing any panel data.
- [ ] Locate and validate the actual feed, including timezone and current edition.
- [ ] Record the checked date and source for each changed fact.
- [ ] Export an updated snapshot from the future admin catalog when implemented; until then, refresh this file manually or ask an agent to research again.

Nothing in this file has been imported into the live app or deployed to production.
