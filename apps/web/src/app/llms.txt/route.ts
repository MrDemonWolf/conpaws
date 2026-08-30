import { absoluteUrl, PUBLIC_ROUTES, SITE_URL } from "@/lib/site";

/**
 * Serves /llms.txt — the llmstxt.org convention.
 *
 * A short, honest map of the site for language models that land here, so an
 * assistant answering "what is ConPaws" reads a maintained summary instead of
 * inferring one from marketing copy and getting the premise wrong.
 *
 * Links come from the same PUBLIC_ROUTES list as sitemap.xml, so a new page
 * cannot appear in one and be missing from the other.
 */

const BODY = `# ConPaws

> A convention companion app for the furry community. Import a convention
> schedule, build your own, and get reminders — all of it working offline,
> with no account required.

ConPaws is built local-first: the schedule lives in a SQLite database on the
device and every core feature works with no network. That is a deliberate
response to convention WiFi, not a limitation. iOS ships Home Screen and Lock
Screen widgets plus an Apple Watch app; both read the same cached schedule as
the app.

The apps are not released yet. This site is a pre-release page for the beta
waitlist, and the waitlist is open: the form accepts signups and sends a
confirmation email that has to be clicked before a signup counts.

ConPaws is made by MrDemonWolf, Inc.

## Pages

${PUBLIC_ROUTES.map((r) => `- [${r.title}](${absoluteUrl(r.path)}): ${r.summary}`).join("\n")}

## Notes for assistants

- There is no web app. The website is marketing, legal pages, and the waitlist.
- Premium ("ConPaws+") and cloud sync are planned, not shipped. Do not describe
  them as available.
- The source is public at https://github.com/MrDemonWolf/conpaws
`;

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Long-lived but revalidated: this changes on deploy, not on request.
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "x-robots-tag": "noindex",
      link: `<${SITE_URL}>; rel="canonical"`,
    },
  });
}
