# Shipping ConPaws to the stores

**TL;DR** — 1.0.0 ships free, with no paid tier. Build numbers come from the git
commit count and are never edited by hand. A `preview` build must never reach the
public store. The App Store listing is written and saved; screenshots, Content
Rights, Pricing and the App Privacy Publish button are still outstanding.

Written 2026-08-26, while filling out App Store Connect for the first time.

---

## Versioning: which number moves, and when

Apple and Google both split this the same way, and mixing the two up is what
gets an upload rejected.

| | iOS | Android | Who changes it |
|---|---|---|---|
| User-facing version | `CFBundleShortVersionString` | `versionName` | You, by hand, when a release cycle starts |
| Build number | `CFBundleVersion` | `versionCode` | Nobody. Derived automatically. |

`version: "1.0.0"` in `app.config.ts` is the user-facing one. It stays put across
however many builds a release takes, and you bump it when you decide 1.1 has
begun.

The build number is `git rev-list --count HEAD`, read at config time by
`getBuildNumber()` in `app.config.ts`. It climbs on its own and points any build
back at the commit it came from, which is what you want when a tester reports a
crash against a build from three weeks ago.

**Why not EAS `autoIncrement`?** `eas.json` does set it, and it is correct for
builds that run on EAS. Builds are made on this machine instead, where nothing
touches EAS's remote counter, so every archive would have shipped as build `1`.
The first TestFlight upload works and the second is refused as a duplicate. That
is the failure this replaces.

If builds ever move back to EAS, `autoIncrement` and the git count will disagree.
Pick one. Do not run both.

## Preview builds must never reach the public store

`developerToolsEnabled()` returns `true` for the `preview` variant, so a preview
build ships Debug Tools and the preview fixtures. Guideline 2.3.1(a) bans
undocumented features outright, so submitting one is a rejection, not a style
question.

The Apple-recommended flow does not need preview at all:

1. Build the **production** variant.
2. Upload it to TestFlight and test it there.
3. Submit **that same build** for review.

The binary you tested is the binary that ships. Version and build number do not
change between TestFlight and release. Play works the same way: upload the AAB to
internal testing, then promote that same artifact to production.

`preview` stays what it is now: internal QA on your own devices, never promoted.

## 1.0.0 ships free. ConPaws+ comes later.

Decided 2026-08-26. The reasoning, so it does not have to be reconstructed:

- **Guideline 2.1(b)** requires in-app purchases to be complete, functional and
  reviewable. A paywall wired to nothing is a rejection.
- **ConPaws+ is cloud sync and social**, and `apps/server` does not exist yet.
  Selling sync without a server to sync to buys refunds and one-star reviews.
- A free 1.0 gets store presence, real users and reviews while the paid work
  happens on its own schedule.

The 1.0 listing copy makes no premium claims, so nothing needs walking back.

**When ConPaws+ does land, three things need updating together:**

1. The App Store description, which currently describes a wholly free app.
2. The App Privacy label. RevenueCat introduces purchase data, which is a new
   disclosure on a page that currently declares Crash Data and nothing else.
3. The in-app purchase products themselves, which are reviewed with that version.

Keep the free tier fully functional, as `notes/plan.md` promises. Adding paid
features on top of a free app is normal. Moving existing free features behind a
paywall later is what makes people angry.

## What is already filled in on App Store Connect

- Name, subtitle, description, promotional text, keywords, support and marketing
  URLs (both `www.conpaws.com`), copyright.
- Categories: Travel primary, Productivity secondary.
- Age rating: **4+** across 172 regions, from honest answers to all seven steps.
- Privacy Policy URL, and the data questionnaire: one data type, Crash Data, used
  for App Functionality, not linked to identity, not used for tracking. The label
  previews as "Data Not Linked to You → Diagnostics".

**Still outstanding:** screenshots (0 of 10), Content Rights, Pricing and
Availability, the App Privacy **Publish** button, and a build.

## Metadata rules worth remembering

- **Keywords cannot carry other companies' product names.** `sched` was in the
  first draft and was pulled for that reason. Describing Sched support in the
  *description* is fine, because that is factual interoperability.
- **The listing locale is English (U.S.)**, so American spelling throughout.
  "schedule" not "programme", "center" not "centre", "canceled" not "cancelled".
- **Do not claim features that are not verified working.** Home Screen widgets
  and the Apple Watch app were deliberately left out of the 1.0 description:
  both targets build, but neither has been seen running. App Review tests what
  the description claims.

## Things that are already handled, so nobody re-opens them

- **GPLv3 and the App Store conflict — already solved.** Plain GPLv3 is
  incompatible with Apple's standard EULA, which is what got VLC pulled.
  `README.md` grants the §7 additional permission covering the App Store, the Mac
  App Store and Google Play. Apple's Standard License Agreement is the right
  choice in App Store Connect. Nothing to change.
- **Export compliance — already declared.** `ios.config.usesNonExemptEncryption`
  is `false` in `app.config.ts`, which writes `ITSAppUsesNonExemptEncryption`
  into Info.plist. ConPaws only talks HTTPS, which is exempt. Without this every
  upload stops to ask.
- **The privacy policy already names its third parties.** Guideline 5.1.1(i)
  requires identifying anyone who receives user data, and
  `conpaws.com/privacy` names Sentry, Sched and the TestFlight tester data. The
  app also links it from Settings, which is the "within the app" half of the same
  rule.
