/**
 * The "Show me how" walkthroughs in Settings > Getting started and in the
 * import screen's help: one guide per way of getting a schedule into ConPaws.
 *
 * Pure data with no runtime imports, so the Node test environment loads it.
 * Every i18n key is written out as a full literal: the unused-key scan in
 * `locales.test.ts` only counts quoted keys.
 */

export const HOW_TO_METHODS = ["find", "sched", "ics"] as const;
export type HowToMethod = (typeof HOW_TO_METHODS)[number];

/** The import help offers these. Find would need the import sheet closed first. */
export const IMPORT_HELP_METHODS = [
  "sched",
  "ics",
] as const satisfies readonly HowToMethod[];
export type ImportHelpMethod = (typeof IMPORT_HELP_METHODS)[number];

/** The decorative mockup a card or step shows (`components/how-to/pictures`). */
export type HowToPictureId =
  | "catalog-search"
  | "catalog-detail"
  | "catalog-download"
  | "catalog-not-listed"
  | "sched-site"
  | "sched-copy"
  | "import-link"
  | "import-review-sched"
  | "website-calendar-link"
  | "link-or-file"
  | "import-ics"
  | "import-review-file";

export interface HowToStep {
  id: string;
  picture: HowToPictureId;
  /** Full i18n key. */
  title: string;
  /** Full i18n key. */
  body: string;
  /**
   * Placeholder name -> i18n key of the real control's label, resolved with
   * t() at render so the step always names the control the app shows. Never
   * name one `count`, `context`, `ns`, `lng` or `defaultValue`: i18next
   * reserves those.
   */
  labels?: Readonly<Record<string, string>>;
}

export interface HowToGuide {
  title: string;
  summary: string;
  /** The picture on the method's card in Getting started. */
  hero: HowToPictureId;
  /** The real screen the last step's button opens. */
  destination: "/convention/find" | "/convention/new/import";
  /** The last step's button label in Settings. */
  finishLabel: string;
  steps: readonly HowToStep[];
}

export const HOW_TO_GUIDES: Readonly<Record<HowToMethod, HowToGuide>> = {
  find: {
    title: "howTo.find.title",
    summary: "howTo.find.summary",
    hero: "catalog-search",
    destination: "/convention/find",
    finishLabel: "settings.help.find",
    steps: [
      {
        id: "search",
        picture: "catalog-search",
        title: "howTo.find.steps.search.title",
        body: "howTo.find.steps.search.body",
      },
      {
        id: "check",
        picture: "catalog-detail",
        title: "howTo.find.steps.check.title",
        body: "howTo.find.steps.check.body",
      },
      {
        id: "download",
        picture: "catalog-download",
        title: "howTo.find.steps.download.title",
        body: "howTo.find.steps.download.body",
        labels: { button: "catalog.confirm.download" },
      },
      {
        id: "notListed",
        picture: "catalog-not-listed",
        title: "howTo.find.steps.notListed.title",
        body: "howTo.find.steps.notListed.body",
        labels: { button: "catalog.notListed.import" },
      },
    ],
  },
  sched: {
    title: "howTo.sched.title",
    summary: "howTo.sched.summary",
    hero: "import-link",
    destination: "/convention/new/import",
    finishLabel: "settings.help.importNow",
    steps: [
      {
        id: "open",
        picture: "sched-site",
        title: "howTo.sched.steps.open.title",
        body: "howTo.sched.steps.open.body",
      },
      {
        id: "copy",
        picture: "sched-copy",
        title: "howTo.sched.steps.copy.title",
        body: "howTo.sched.steps.copy.body",
      },
      {
        id: "paste",
        picture: "import-link",
        title: "howTo.sched.steps.paste.title",
        body: "howTo.sched.steps.paste.body",
        labels: {
          screen: "import.title",
          field: "import.url",
          button: "import.fetchSchedule",
        },
      },
      {
        id: "review",
        picture: "import-review-sched",
        title: "howTo.sched.steps.review.title",
        body: "howTo.sched.steps.review.body",
      },
    ],
  },
  ics: {
    title: "howTo.ics.title",
    summary: "howTo.ics.summary",
    hero: "import-ics",
    destination: "/convention/new/import",
    finishLabel: "settings.help.importNow",
    steps: [
      {
        id: "find",
        picture: "website-calendar-link",
        title: "howTo.ics.steps.find.title",
        body: "howTo.ics.steps.find.body",
      },
      {
        id: "save",
        picture: "link-or-file",
        title: "howTo.ics.steps.save.title",
        body: "howTo.ics.steps.save.body",
      },
      {
        id: "add",
        picture: "import-ics",
        title: "howTo.ics.steps.add.title",
        body: "howTo.ics.steps.add.body",
        labels: {
          screen: "import.title",
          field: "import.url",
          fetch: "import.fetchSchedule",
          button: "import.chooseFile",
        },
      },
      {
        id: "review",
        picture: "import-review-file",
        title: "howTo.ics.steps.review.title",
        body: "howTo.ics.steps.review.body",
      },
    ],
  },
};

/** A route param that names a guide: one of `HOW_TO_METHODS`, exactly. */
export function isHowToMethod(value: unknown): value is HowToMethod {
  return (
    typeof value === "string" &&
    (HOW_TO_METHODS as readonly string[]).includes(value)
  );
}
