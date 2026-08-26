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
 * time, a tag and a room; a stat has a value and a label. Expressing those in
 * MDX means either frontmatter arrays, which is YAML wearing a costume and
 * loses type-checking, or JSX inside MDX, which is the component you were
 * trying to get away from with extra steps.
 *
 * What this buys instead: `as const` plus the exported types means a typo in a
 * key, a missing field, or a `tag` that is not one of the four allowed values
 * fails `tsc` rather than rendering blank. A CMS that catches your mistakes
 * before deploy is worth more than one that renders markdown.
 *
 * The FAQ is the one genuine candidate for MDX — answers are prose and will
 * grow links and emphasis. See `faq.mdx` in this directory.
 */

/**
 * Heading for the FAQ section. Lives here, not as an `export const` in
 * faq.mdx, because it is a record like everything else in this file — and
 * because `@types/mdx` declares `*.mdx` with a default export only, so named
 * MDX exports need an ambient redeclaration that fights the shipped types for
 * no real gain.
 */
export const FAQ_HEADING = {
  eyebrow: "Con ops desk",
  title: "Questions, answered",
} as const;

/** Feature rows, presented as a convention programme. Times are decorative. */
export interface LineupItem {
  /** Programme-guide time. Sorts the visual rhythm, not real scheduling. */
  time: string;
  title: string;
  body: string;
  tag: "Core" | "QoL" | "Safety";
  /** Fictional room, part of the programme-guide conceit. */
  room: string;
}

export const LINEUP: readonly LineupItem[] = [
  {
    time: "10:00",
    title: "Import any schedule",
    body: "Drop in an .ics file or paste a Sched link. Re-import later without losing what you've picked.",
    tag: "Core",
    room: "Main Hall",
  },
  {
    time: "13:30",
    title: "Smart reminders",
    body: "Nudges before the events you choose. Nothing else, ever.",
    tag: "QoL",
    room: "Panel Room 2",
  },
  {
    time: "16:00",
    title: "Content flags",
    body: "18+ and photosensitivity warnings surfaced automatically from the schedule.",
    tag: "Safety",
    room: "Ops",
  },
  {
    time: "23:59",
    title: "Works offline",
    body: "Everything lives on your phone. Con WiFi dying at peak hours is someone else's problem now.",
    tag: "Core",
    room: "Everywhere",
  },
] as const;

export interface Step {
  /** Zero-padded, and rendered as-is — it is a label, not a computed index. */
  n: string;
  title: string;
  body: string;
}

export const STEPS: readonly Step[] = [
  { n: "01", title: "Download", body: "Free on iOS and Android at launch." },
  {
    n: "02",
    title: "Pick your convention",
    body: "Import its schedule, or start one from scratch.",
  },
  {
    n: "03",
    title: "Build your weekend",
    body: "Star what you want. Get nudged before it starts.",
  },
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

/**
 * Marquee words.
 *
 * "Open source" was removed deliberately — keep this list to things the app
 * does, not to how it is built. The screen-reader sentence in the Ticker
 * component reads this array, so adding an item here also updates that.
 */
export const TICKER_ITEMS: readonly string[] = [
  "Schedules",
  "Offline first",
  "Reminders",
  "Content flags",
  "iOS",
  "Android",
] as const;
