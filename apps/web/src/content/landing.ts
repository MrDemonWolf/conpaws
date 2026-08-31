/**
 * Every word on the landing page that is not structural.
 *
 * This file exists so copy can be edited without opening a component. Change
 * a headline here and the page follows; the layout, the animation delays and
 * the phone mockups stay where they belong.
 *
 * Why this is TypeScript and not MDX, given the legal pages are MDX:
 *
 * MDX earns its place where the content IS prose — `/privacy` is a document,
 * and authoring it as markdown is plainly better than as JSX. None of the
 * content below is a document. It is records with fields: a lineup row has a
 * time and a tag; a stat has a value and a label. Expressing those in
 * MDX means either frontmatter arrays, which is YAML wearing a costume and
 * loses type-checking, or JSX inside MDX, which is the component you were
 * trying to get away from with extra steps.
 *
 * What this buys instead: `as const` plus the exported types means a typo in a
 * key, a missing field, or a `tag` that is not one of the four allowed values
 * fails `tsc` rather than rendering blank. A CMS that catches your mistakes
 * before deploy is worth more than one that renders markdown.
 *
 * The FAQ answers are prose and were briefly an MDX file; that turned out to
 * buy nothing over the catalogs, which already carry inline links, so the copy
 * lives in `i18n/messages` with the rest of the translated strings.
 */

/**
 * Feature rows, presented as a convention programme. Times are decorative.
 *
 * Titles, bodies and rooms are NOT here: `landing.tsx` zips these entries with
 * `messages.lineup.items[i]` and takes all three from the catalog, because
 * they are copy and copy is translated. They used to be duplicated here too,
 * unread, which is a second source of truth that only ever drifts — the
 * English catalog is the one that renders.
 */
export interface LineupItem {
  /** Programme-guide time. Sorts the visual rhythm, not real scheduling. */
  time: string;
  tag: "Core" | "QoL" | "Safety";
}

export const LINEUP: readonly LineupItem[] = [
  { time: "10:00", tag: "Core" },
  { time: "13:30", tag: "QoL" },
  { time: "16:00", tag: "Safety" },
  { time: "23:59", tag: "Core" },
] as const;

/** Step numbers. Titles and bodies come from `messages.steps.items[i]`. */
export interface Step {
  /** Zero-padded, and rendered as-is — it is a label, not a computed index. */
  n: string;
}

export const STEPS: readonly Step[] = [
  { n: "01" },
  { n: "02" },
  { n: "03" },
] as const;

export interface Stat {
  value: string;
  label: string;
}

/**
 * Claims, not metrics. Every one has to stay literally true — "0 accounts"
 * stops being true the day sign-in ships, and this is the line that has to
 * change with it.
 */
export const STATS: readonly Stat[] = [
  { value: "100%", label: "of features work offline" },
  { value: "0", label: "accounts needed to use it" },
  { value: "1 link", label: "imports a whole schedule" },
  { value: "∞", label: "conventions in one app" },
] as const;
