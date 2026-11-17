# AGENTS.md

Import fixtures. Root [AGENTS.md](../AGENTS.md) also applies. Paths in the preserved guidance below are relative to the repository root unless stated otherwise.

Test data for iCal import development lives in `test-data/`. **Every fixture is
fully dummied** — invented convention, venue, room, panel and person names — and
it must stay that way: no real convention's export goes in this repo, for
trademark reasons and because the descriptions are other people's writing. The
fixtures are traced from real exports, so the *structure* is faithful even
though none of the text is:

- `sched-example-con.ics` — Sched shape, 210 events. Unfolded long lines, one
  UPPERCASE topic per event, no audience tag, `Room\, Venue` locations,
  32-hex UIDs, `&nbsp;` entities.
- `sched-small-con.ics` — the same shape, hand-sized (16 active + 2 cancelled).
  The characterization fixture: weekend-spanning event, same-minute collisions,
  literal `\n` pairs, an empty DESCRIPTION, and both tombstone shapes
  (a `STATUS:CANCELLED` block shadowing an active event, and a bare tombstone).
  Cancellations are the one hand-written part — Sched drops a cancelled row
  rather than publishing it.
- `event-ticket-con.ics` — a convention's own ticketing export, 202 events.
  RFC 5545 folding at 75 octets, several Title Case topics plus an
  `Age all` / `Age 13` / `Age 18` audience tag, `Area – Room` locations split by
  an **en-dash** rather than a comma, and a description that repeats the event's
  own permalink.
- `tribe-events-con.ics` — The Events Calendar (ECP) export, 30 events. The only
  fixture with **no `X-WR-TIMEZONE`**: the zone comes off the first event's
  `DTSTART;TZID` parameter, times are local wall-clock rather than UTC, and a
  `VTIMEZONE` block carries its own bare `DTSTART:` lines that must not be read
  as events. Some events omit LOCATION or CATEGORIES entirely.
- `small-test.ics` — hand-written fixture (10 events, 3-day fictional con).

`detectFeedSource` (`apps/native/src/lib/feed-source.ts`) tags a body as
`"sched"` or `"generic"` and lands on `ParseResult.source`. It is deliberately a
label: nothing in the parser branches on it, so a wrong guess can mislabel the
import preview but never mis-parse a feed.
