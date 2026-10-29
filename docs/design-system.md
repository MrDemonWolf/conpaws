# ConPaws design system

The app, marketing site and admin console share a brand, with different layouts
and platform behavior. Reuse the existing primitives and semantic tokens before
adding a component or a color. The current landing navbar and larger typography
are the approved starting point.

## Sources of truth

| Surface | Tokens and typography | Components |
| --- | --- | --- |
| Website | `packages/ui/src/styles/globals.css`; `apps/web/src/index.css`; fonts in `apps/web/src/components/document.tsx` | Shared HTML primitives in `packages/ui/src/components`; marketing patterns in `apps/web/src/components` |
| Admin | Shared web tokens, overridden by `apps/admin/src/app/globals.css` | Shared HTML primitives, adapted by `apps/admin/src/components/ui.tsx` |
| Native | `apps/native/src/global.css`; imperative color mirror in `apps/native/src/lib/theme-tokens.ts` | `apps/native/src/components/ui`; interactive gallery at `apps/native/app/(tabs)/settings/ui-system.tsx` |

Do not copy web CSS into NativeWind or replace native components with HTML
primitives. Native targets, semantic iOS colors and Dynamic Type have their own
requirements. There is no generated cross-platform token package today.

## Color and surfaces

| Purpose | Website and admin | Native |
| --- | --- | --- |
| Brand accent | `#0faced`, with `#041f2e` text on filled buttons | Light `#005575` with white text; dark `#18b7f2` with black text |
| Main surface | Marketing dark navy `#091533`; admin light `#f5f7fb` | Light white/dark black fallback; iOS uses `systemBackground` |
| Raised surface | Marketing `#0f1d45`; admin white | Light `#f2f2f7`/dark `#1c1c1e` fallback; iOS uses `secondarySystemBackground` |
| Body and supporting text | `foreground` and `muted-foreground` | Same semantic names; iOS uses label colors where configured |
| Status | Admin `StatusPill`/`Banner` contextual styles; filled destructive variants pair red with navy text | Paired `info`, `success`, age-rating and destructive tokens |

The website forces dark appearance in `providers.tsx`; admin declares light
appearance. Native follows the resolved app appearance. Different native primary
shades are intentional contrast adaptations, not brand drift. Android must keep
the tested fallback palette until its generated theme supports Material 3 color
attributes; unresolved `PlatformColor` resources previously crashed startup.

Use paired foreground/background tokens. White on the web brand cyan is only
2.58:1; the existing navy foreground is 6.56:1. Cyan text on white has the same
2.58:1 limitation. Use a darker contextual color when introducing links on light
surfaces. WCAG AA requires at least 4.5:1 for ordinary text and 3:1 for qualifying
large text. [Contrast reference](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

## Typography and layout

| Surface | Current scale and use |
| --- | --- |
| Marketing | Montserrat for headings/body; Roboto Mono for technical labels. Body 16px on phones/18px at larger widths; navigation 15px/16px; section headings 32–44px; hero 36–64px; FAQ questions 18px and answers 16px. |
| Admin | Roboto body, Montserrat headings, Roboto Mono for technical values. Shared controls use 16px text on phones; admin CSS keeps native form-control font size at 16px. |
| Native | `Text` variants map to body 17, caption 13, label 15, h3 22, h2 28 and h1 34. Native Dynamic Type supplies scaling; avoid fixed line heights and disabling font scaling. |

Small text inside the website's miniature phone artwork is illustrative, not the
reading-size standard for interactive pages. Keep its accessible figure labels.
Use Roboto Mono for times and identifiers, not long paragraphs.

Use Tailwind's spacing scale and existing component padding. Native `Card` uses
`rounded-2xl` and continuous corners; shared web cards and buttons use radius
tokens, while admin sets the base radius to `0.75rem`. These are contextual
defaults, not a requirement to make every surface identical.

Keep marketing copy in `apps/web/src/i18n` catalogs. All 23 locale routes share
the same layout; do not fork English JSX or hardcode replacement labels. Retain
word wrapping, `min-w-0`, the language picker's compact mode, and the shared
`Document` root language/font setup. Test long German/Norwegian labels and CJK
fallbacks before changing widths or headings.

## Component states and reuse

| Primitive or pattern | Existing behavior | Rule for new usage |
| --- | --- | --- |
| Shared web `Button` | Six variants, four sizes, hover/focus/disabled states; default/icon target 44px, small target 40px | Use `buttonVariants` for anchors. Keep button semantics for actions and anchor semantics for navigation; retain paired foreground tokens. |
| Shared `Input`/`Textarea` | 44px input minimum, flexible width, focus border/ring, disabled state | Prefer admin `Field`/`TextAreaField` when labels and inline errors are needed. Associate labels and errors; placeholders do not replace labels. |
| Admin `Field`/`TextAreaField` | Label association, `aria-invalid`, error description and alert | Use existing wrappers rather than pasting field markup. |
| Native `Button` | Five variants, three sizes, 48px minimum, pressed feedback, busy and disabled accessibility state | Use loading for asynchronous actions and preserve an accessible name. |
| Native `Text`/`NativeText` | Semantic type variants and platform-specific text rendering | Use `Text` for RN layouts and `NativeText` inside the existing Expo UI patterns. Register custom type sizes in `cn()` if extending the scale. |
| Native `Input` | Label, per-theme placeholder color, error alert and accessibility hint | Carry the visible error into the accessibility hint. |
| Native `Badge`/`Chip` | Semantic status pairs; selected state on chips; bordered neutral pills | Never communicate status or selection through color alone. |
| Marketing FAQ/language picker | Native `details`/`summary`; language picker closes on Escape/outside click after hydration | Preserve keyboard operation, visible focus and the `data-lang-menu`/`data-locale` hooks. |
| Waitlist | Labeled fields, submitting/disabled/error states, focus moved to success | Keep the live configuration gate and submission behavior separate from styling. |

The website supplies a global focus outline, a skip link, reduced-motion-aware
entry effects, and a thumb action that hides while a field or language menu is
active. Preserve these when changing the layout. A visible keyboard focus
indicator is required; having a focus class in source is not browser proof.
[Focus reference](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

ConPaws generally uses larger touch targets than WCAG's 24px minimum; that
minimum also has defined spacing and inline-link exceptions. Do not shrink the
existing 44px web or 48px native primary controls to that minimum.
[Target-size reference](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

## Audit findings and testing boundaries

Source audit on 2026-10-28 reviewed the token files, shared web
Button/Input/Textarea/Badge/Card, admin UI adapters, native
Text/NativeText/Button/Input/Badge/Chip/Card, and marketing navigation, waitlist,
FAQ, language picker and mobile action.

- Fixed a stale shared-token comment that described native colors as identical
  to web and incorrectly reported a native primary-foreground contrast bug.
- Fixed shared web destructive `Button` and `Badge` contrast by replacing white
  labels with the paired navy `destructive-foreground` token. Red fills and
  destructive semantics stay unchanged. Five checks in
  `apps/web/src/lib/theme-contrast.test.ts` pass: both themes' primary/destructive
  filled pairs, destructive hover over page/card, and actual primitive usage.
- The palettes are intentionally separate. Native has automatic CSS/JS drift
  and contrast tests; shared-web filled-action pairs now have contrast coverage.
  This does not check every contextual or translucent color combination.
- Shared primitives coexist with contextual admin styles and marketing artwork.
  Reuse them where semantics match; do not turn this into a broad token rewrite.
- Source checks do not establish browser contrast over gradients/transparency,
  keyboard usability, Dynamic Type layout, screen-reader behavior or device
  rendering. Those need rendered checks.

Before accepting a visual change:

- [ ] Run relevant workspace tests, typechecks and explicit-path Biome checks.
- [ ] Build and smoke-test the Worker rather than treating `next dev` as a
  waitlist test. `apps/web/scripts/e2e.ts` checks locale HTML, routes and
  fail-closed signup; it does not measure rendered layout.
- [ ] Check all 23 locales and public pages for horizontal overflow at 320px and
  375px. The existing `apps/web/scripts/overflow.ts` contains that layout check;
  use the browser tooling permitted by `AGENTS.md` for interactive validation.
- [ ] Tab through navbar, language picker, FAQ and form; check visible focus,
  Escape, success/error states and reduced motion.
- [ ] Exercise native light/dark appearance, large text, long labels, loading,
  empty/error and keyboard states on an actual simulator/dev build.
- [ ] Record physical-device and signed-store testing separately from local
  JavaScript export, unit tests, simulator checks and production deployment.

Local checks and current blockers belong in the dated readiness report under
`docs/reviews/`; this guide describes the system and its acceptance rules.
