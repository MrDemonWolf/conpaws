# ConPaws - Future Feature Ideas

Brainstorm list of potential features. Nothing here is committed — just ideas to revisit as the app grows.

---

## TL;DR

- **Schedule:** Conflict detection, "Happening Now" view, smart reminders, QR sharing
- **Widgets:** iOS Home Screen, Lock Screen, Siri Shortcuts
- **Social:** Social links, fursona showcase, con history, group schedules, friends
- **Tools:** Packing checklist, con info card, expense tracker, maps
- **Gamification:** Badges/achievements, con streaks, check-ins
- **Community:** First-timer tips, ride sharing, room sharing
- **Pre-Launch Gaps:** Accessibility, time zones, error states, App Store prep (see bottom)

---

## Schedule Smarts

- **Conflict detection** — Alert when two saved events overlap ("Opening Ceremony and Fursuit Parade are at the same time!")
- **"Happening Now" view** — Quick-access screen showing what's going on right now at the con, filtered to your saved events
- **Smart reminders** — Customizable lead time per event (15 min, 30 min, 1 hour) instead of one-size-fits-all
- **Schedule QR sharing** — Generate a QR code at the con for instant schedule sharing. Scan a friend's QR to see their public schedule

---

## Widgets & System Integration

- **iOS Home Screen widgets** — Next event countdown, today's schedule at a glance, convention countdown
- **Lock Screen widgets** — Compact next-event widget (iOS 16+)
- **Siri Shortcuts** — "Hey Siri, what's my next panel?" or "Show my schedule for today"
- **Share extension** — Share a Sched URL from Safari directly into ConPaws

---

## Profile & Social

- **Social links on profile** — Bluesky, Twitter/X, Telegram, FurAffinity, website (icon row under bio)
- **Fursona showcase** — Species, name, ref sheet link on profile (huge in the furry community)
- **Convention history** — "Attended" list on profile showing past cons with years
- **Group schedules** — Create a shared schedule with friends going to the same con, vote on which panels to attend together
- **Friends / following system** — Follow other users, see their schedules
- **In-app messaging** — DMs between attendees at the same convention
- **Activity feed** — See what friends added to their schedules

---

## Convention Tools

- **Packing checklist** — Template checklist for con essentials (badge, fursuit, charger, etc.) with customizable items
- **Con info card** — Store hotel room number, parking spot, emergency contact, hotel WiFi password — quick reference during the con
- **Expense tracker** — Track spending at the con (dealer's den purchases, food, etc.) with optional budget
- **Convention maps** — Interactive floor maps with room/panel locations (if cons provide maps)
- **Dealer's Den / Artist Alley directory** — Browse vendors with booth numbers (if cons provide data)

---

## Gamification

- **Convention badges/achievements** — "First Con," "5 Cons Attended," "Panel Hopper (10+ panels in one day)," "Early Bird (attended an 8am panel)"
- **Con streak** — Track consecutive years attending the same convention
- **Check-in** — Check in at a convention to confirm attendance (visible on profile)

---

## Community

- **First-timer tips** — Opt-in "first time at this con?" mode with helpful tips and suggestions
- **Ride sharing board** — Find/offer rides to the convention (per-con)
- **Room sharing board** — Find hotel roommates (per-con)
- **Lost & found** — Per-convention lost & found board

---

## Cosmetic / Monetization

- **Custom app icons** — Alternative app icons (dark, pride flags, seasonal) as a ConPaws+ perk
- **Convention-specific themes** — Unlock a custom color theme when attending a specific con
- **iMessage sticker pack** — Furry/convention-themed stickers

---

## Way Out There

- **Apple Vision Pro** — 3D convention maps?
- **Fursuit meetup tracker** — Mark photo spots, coordinate group photos
- **AI schedule suggestions** — "Based on what you liked at MFF, you might enjoy these panels at Anthrocon"
- **Convention partnerships** — Official app integration where cons push their schedule directly to ConPaws users

---

## Pre-Launch Improvements (Plan Gaps)

Things not yet in the plan that should be addressed before or shortly after launch.

### Must-Add (will block launch or cause real problems)

- **Accessibility** — VoiceOver labels on all interactive elements, Dynamic Type support (text scales with system settings), minimum contrast ratios (4.5:1), reduce motion support. The furry community values inclusion — IndyFurCon literally has a blind performer and disability services.
- **App Store submission checklist** — Screenshot specs per device (6.7", 6.5", 5.5" iPhone + iPad), app description, keywords for ASO, age rating questionnaire, privacy nutrition labels, review notes for the reviewer ("test account: ..., how to test iCal import: ...")
- **Schedule re-import / refresh** — What happens when a con updates their Sched after you already imported? Options: manual re-import with diff preview ("12 updated, 3 new, 2 removed"), user picks keep/replace per conflict. Personal schedule choices (isInSchedule, reminders) must survive re-import.
- **Time zone handling** — iCal stores UTC. App must convert to convention's local time zone for display. Store convention time zone on import (from `X-WR-TIMEZONE` or `VTIMEZONE` in the .ics). Handle DST transitions during multi-day cons. Display times in con-local, not device-local.
- **Error & empty states** — Every screen needs a zero-data state: no conventions yet ("Import your first convention!"), no events today ("Nothing scheduled — enjoy the free time!"), import failed ("Couldn't read this file. Is it a valid .ics?"), sync failed ("Offline — changes will sync when you reconnect"). Loading spinners for imports, skeleton screens for lists.
- **Notification permission flow** — Don't ask on first launch. Ask when user sets their first event reminder (contextual, higher acceptance rate). If denied, show inline message: "Enable notifications in Settings to get reminders." Link to system settings. Never nag repeatedly.

### Should-Add (will cause support headaches post-launch)

- **Subscription restore** — User gets new phone, ConPaws+ looks "gone." Add "Restore Purchases" button in Settings. RevenueCat handles this but the button needs to exist. Silent restore check on app launch too.
- **Large file handling** — A big con (200+ events) could take a few seconds to parse. Show progress: "Importing... 142/208 events". Parse in chunks so UI doesn't freeze. Test with the full IndyFurCon file (127 events) as baseline.
- **Database cleanup** — Conventions that ended 6+ months ago: prompt "Archive old conventions?" Move to archived state (still viewable, not in main list). Never auto-delete — user might want to look back at past cons.
- **Analytics (lite, privacy-first)** — No PII, no tracking IDs. Just aggregate counts: how many imports (file vs URL), premium conversion rate, which categories are most saved, crash-free session rate. Could use Sentry's session tracking or a simple self-hosted counter. Helps know what to improve without being creepy.
- **Convention data source diversity** — Not every con uses Sched. Research other platforms furry cons use (Guidebook, custom websites, Google Sheets). At minimum, manual .ics file import covers everything since most calendar tools export .ics.
- **Offline sync queue resilience** — What if a queued sync item permanently fails? (deleted convention on server, schema mismatch). Retry 3x with exponential backoff, then move to dead-letter state. Show user: "1 change couldn't sync — tap to retry or discard."

### Nice-to-Have (can add later)

- **Admin / support tooling** — Simple web dashboard to look up users, view subscription status, trigger manual account deletion. Even a basic Supabase SQL query cheat sheet helps.
- **Background sync scheduling** — iOS background fetch to drain offline queue when app isn't open. Battery-friendly, respects low power mode. Not critical if sync happens reliably on app open.
- **Localization testing** — RTL language support (Arabic, Hebrew), long German text overflow, CJK character handling, plural form testing (English "1 event" vs "2 events" is simple, other languages aren't).
- **iPad split view edge cases** — Convention list on left, detail on right. What if user deletes the convention showing in detail? Handle gracefully with empty state.
- **Multi-device session management** — Sign out on one device: revoke just that session or all? Recommendation: just that device. Supabase handles this per-token.
- **App size budget** — Target under 30MB install size. Monitor with each release. Biggest risks: bundled animal icons, Prisma engine binary, Sentry SDK. Use `npx expo-doctor` to audit.
- **Version upgrade safety** — What if a Prisma migration fails halfway on a user's device? Show error screen with "Contact Support" + Sentry auto-report. Never leave DB in a half-migrated state (transactions handle this, but test it).
- **RevenueCat edge cases** — Sandbox vs production certificate mismatches, interrupted purchases (user closes App Store mid-buy), family sharing entitlement sharing, promotional offers setup.

---

*Add ideas here as they come up. Revisit after each convention season to see what users actually want.*
