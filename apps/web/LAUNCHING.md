# Website modes

`NEXT_PUBLIC_SITE_MODE` controls the public marketing site at build time. It is a GitHub Actions repository variable for production and belongs in `apps/web/.env` for a local Cloudflare preview.

| Value | Website behavior |
| --- | --- |
| `waitlist` (default) | Full landing page with the signup form. |
| `live` | Full landing page with App Store and Google Play links. Both listing URLs are required. |
| `coming-soon` | A simple countdown page. Set `NEXT_PUBLIC_COUNTDOWN_AT` to an ISO 8601 UTC timestamp, such as `2026-12-01T18:00:00Z`. |
| `maintenance` | Replaces the marketing pages with a temporary service notice and pauses waitlist submissions. `NEXT_PUBLIC_MAINTENANCE_MESSAGE` can replace the default notice. |

While the site is in waitlist mode, open `/?mode=live` to preview the finished landing page. Missing store URLs appear as inactive placeholders until real listing links are configured. The query only changes the page preview; it does not change the deployed mode or submit an address.

These are public display settings, not secrets. Changing a production value takes effect with the next normal Alchemy deployment. Do not put these values in `wrangler.jsonc`; it is reserved for local development and CI preview configuration.
