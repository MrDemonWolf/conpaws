import { unfold } from "./ical-text";

/**
 * Which kind of schedule export a calendar body came from.
 *
 * `"sched"` is the only shape we can positively identify: Sched.com stamps its
 * own `PRODID` and hands out per-event URLs on its own domain. Everything else
 * — convention-run exports, ticketing platforms, hand-rolled feeds — is
 * `"generic"`, because claiming to recognise them would be a guess.
 *
 * This is deliberately a *label*, not a parsing switch. Nothing in the parser
 * branches on it, so a wrong answer never produces wrong events; it only
 * mislabels the import preview.
 */
export type FeedSource = "sched" | "generic";

const SCHED_PRODID = /sched\.com/i;

/**
 * A per-event Sched URL, e.g. `https://exampleconvention.sched.com/event/abc123`.
 * Used only when PRODID is missing or has been rewritten by a proxy.
 */
const SCHED_EVENT_URL = /https?:\/\/[a-z0-9-]+\.sched\.com\//i;

/**
 * Tags a raw `.ics` body with the export that produced it.
 *
 * ponytail: PRODID first, one body-wide URL scan as a fallback. A feed that
 * merely *links* to a Sched page without being a Sched export would be
 * mislabelled — acceptable while nothing branches on the answer. If something
 * ever does, tighten the fallback to require a `URL:` property line.
 */
export function detectFeedSource(raw: string): FeedSource {
  if (!raw || raw.trim().length === 0) return "generic";

  const unfolded = unfold(raw);

  const prodId = unfolded
    .split(/\r?\n/)
    .find((line) => line.toUpperCase().startsWith("PRODID"));
  if (prodId && SCHED_PRODID.test(prodId)) return "sched";

  return SCHED_EVENT_URL.test(unfolded) ? "sched" : "generic";
}
