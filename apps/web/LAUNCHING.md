# Configure the website launch mode

`NEXT_PUBLIC_SITE_MODE` selects what visitors see on the public site. Set it as a GitHub Actions repository variable for production, or in `apps/web/.env` when building a local Cloudflare preview.

| Mode | What visitors see | Configuration |
| --- | --- | --- |
| `waitlist` (default) | The landing page and signup form. | — |
| `live` | The landing page with App Store and Google Play links. | Set `NEXT_PUBLIC_APP_STORE_URL` and `NEXT_PUBLIC_GOOGLE_PLAY_URL` to the store listings. Both are required for a live build. |
| `coming-soon` | A countdown page. | Set `NEXT_PUBLIC_COUNTDOWN_AT` to an ISO 8601 UTC timestamp, such as `2026-12-01T18:00:00Z`. |
| `maintenance` | A temporary service notice. Waitlist submissions are paused. | Optionally set `NEXT_PUBLIC_MAINTENANCE_MESSAGE` to replace the default notice. |

## Preview the live landing page

When the configured mode is `waitlist`, open `/?mode=live` to preview the finished landing page. If store URLs are not set, the preview shows inactive store buttons. This query changes only the current page view; it does not change the deployed mode or submit a signup.

## Apply production changes

These settings are public build-time values, not secrets. Update the GitHub Actions repository variables; the next production deploy applies them through Alchemy. Keep them out of `wrangler.jsonc`, which is for local development and CI previews.
