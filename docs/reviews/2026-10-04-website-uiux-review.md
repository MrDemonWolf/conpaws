# UI/UX Review: ConPaws website layering

**Reviewed:** 2026-10-04 · **Input:** production website, local browser, source code · **Method:** focused NN/g heuristic evaluation + guideline review

## Executive summary

- Preserve the convention program aesthetic, navy background, cyan actions, and translated content.
- The worst observed issue was a mobile action bar intercepting taps over the language menu in a short viewport.
- Baseline findings: one major and one minor. Both have fixes in this change.
- Scope is the public website; native app and admin UI are excluded.

**Findings:** 0 catastrophic · 1 major · 1 minor · 0 cosmetic

**Browser checks:** 375×320, 375×812, and 1280×900; pointer interaction and Escape dismissal; English, German, and Japanese landing pages plus the shared Updates shell. Confirmed 44px language rows, 48px floating action, correct menu hit testing, hidden action beside signup, and no horizontal overflow in these views. Typecheck and 115 website unit tests pass.

## Findings

### Severity 3 — Major

#### 1. Bottom action intercepts language choices

- **What:** At 375×320, the menu spans y=80–272 and the bottom action starts at y=247. The 25px overlap returns the action link from `elementFromPoint` instead of a language option.
- **Where:** Landing page language menu and fixed mobile action. The open header and action both occupy page layer 40; the later action paints above the header.
- **Guideline:** Keep focused controls visible and actionable. This significantly impedes language selection in short viewports and persists while the menu stays open.
- **Evidence:** [WCAG 2.4.11: Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) explains how sticky footers can obscure controls and recommends preventing overlap.
- **Fix:**
  - [x] Separate floating action (30), header (40), open menu (50), and skip link (60) layers.
  - [x] Keep decorative grain at 0 and badge at 20 inside isolated page shells.
  - [x] Hide the floating action while a language menu or text input is active.
  - [x] Show the action only after the signup section has scrolled above the viewport.
  - [x] Reserve scroll padding and bottom safe-area space for keyboard navigation.

### Severity 2 — Minor

#### 2. Language rows are too small for the mobile design target

- **What:** Production language rows measure 35.5px tall. Their labels are 13px. This falls below the supplied mobile design skill's 44px target; it is not a claim that they fail WCAG's separate 24px minimum.
- **Where:** Every language option in the shared language switcher.
- **Guideline:** Give touch controls enough size for reliable selection.
- **Evidence:** [Touch Targets on Touchscreens](https://www.nngroup.com/articles/touch-target-size/) discusses the effect of target size on touchscreen accuracy.
- **Fix:**
  - [x] Use a minimum 44px row height and 16px option labels.
  - [x] Use 8px menu padding, contained scrolling, and a viewport-constrained width and height.

## Reviewer judgment and design refinements

- Use two font families: Montserrat for primary content, Roboto Mono for technical labels. Keep heading emphasis and cyan accents; avoid a new visual theme.
- Increase signup inputs from 15px to 16px with a minimum 48px height and 12px/16px padding.
- Replace the menu's black shadow with a soft navy shadow. Keep the thumb action 48px tall and give it a subtle white inner highlight.
- Keep miniature app previews' typography separate from real interactive controls. This change does not force every decorative label into four literal font sizes.
- These refinements follow the supplied design skills. [Visual Hierarchy in UX](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) supports prioritizing content through scale, contrast, and grouping.

## Unverified (needs a different input to check)

- Physical iOS/Android keyboards, zoom behavior, VoiceOver, and TalkBack: desktop browser emulation does not prove device behavior.
- Production signup email delivery: no production signup was submitted during this review.
- Full contrast conformance and every locale's text quality: this focused review does not certify the whole site.

## What's working well

- Native details menus work before hydration and support Escape dismissal.
- All language names are presented in their own languages.
- The primary signup has programmatic labels, inline errors, and visible status feedback.
- The corrected thumb action preserves access to signup after reading further down the page.

## Quick wins

- [x] Fix menu/action hit testing in a short mobile viewport.
- [x] Increase mobile language targets and input text size.
- [x] Keep decorative layers behind controls and maintain a clear layer order.
