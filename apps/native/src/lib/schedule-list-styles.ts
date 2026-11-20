/**
 * Presentation rules shared by the two day-grouped schedule lists.
 */

/**
 * What a schedule list is showing:
 * - `list`: rows, which need their own bottom padding or the last row of the
 *   last day runs under the system navigation bar;
 * - `empty`: a centred empty panel, which has to fill the viewport to stay
 *   centred;
 * - `blank`: a convention with no events at all, whose import / add prompt
 *   sits centred with extra room above and below.
 */
export type ScheduleContentKind = "list" | "empty" | "blank";

/**
 * The SectionList content style for one kind, laid into the readable column.
 *
 * The column is padding on the content container rather than a narrower
 * wrapper, so the list stays the screen's scroll view: the large title still
 * lays itself into its inset, the gutters still scroll, and every row, header
 * and footer moves into the column without the cells changing. `padding` is
 * `useContentWidth().listPadding`, zero on a phone in portrait.
 */
export function scheduleContentStyle(
  kind: ScheduleContentKind,
  padding: { paddingHorizontal: number },
) {
  switch (kind) {
    case "list":
      return { paddingBottom: 24, ...padding };
    case "empty":
      return { flexGrow: 1, ...padding };
    case "blank":
      return {
        flexGrow: 1,
        justifyContent: "center" as const,
        paddingBottom: 48,
        paddingTop: 24,
        ...padding,
      };
  }
}

/**
 * Whether a day-grouped schedule list should bounce vertically.
 *
 * Both halves of the rule fix a real screen. Off when empty: a centred "no
 * events" panel that rubber-bands under the finger reads as broken. On when
 * populated: these screens set `headerLargeTitleEnabled`, and UIKit only lays
 * the large title into the scroll view's content inset when that view can
 * scroll, so hard-coding it off painted the title over the first event row on
 * any schedule short enough to fit in one viewport.
 *
 * It is one expression, and that is the reason it lives here rather than being
 * written out at each list: the two schedule screens have already drifted apart
 * on it once, and the failure it causes is subtle enough to survive review.
 */
export function shouldBounceSchedule(
  sections: { length: number },
  headerStandsInForRows = false,
): boolean {
  return sections.length > 0 || headerStandsInForRows;
}

/**
 * Whether the convention screen keeps its list header: the view switcher,
 * the filters and the Now hero card.
 *
 * An empty Plan or Now view hands the screen to its centred empty state,
 * whose button leads back to Browse. A Now view with a hero card is not
 * empty, even when no other panel fits the current hour: the card lives in
 * this header and stands in for the empty state. Hiding the header there hid
 * the card and the switcher with it and left a blank screen.
 *
 * A Plan view is only empty when nothing is saved anywhere. A day with no
 * saves while other days have some keeps the header: the day strip is the
 * way to those days, and hiding it left My plan with no way to change day.
 */
export function showsScheduleHeader(
  view: "all" | "mine" | "now",
  rowCount: number,
  hasNowHero: boolean,
  hasSavedEvents = false,
): boolean {
  return (
    view === "all" ||
    rowCount > 0 ||
    (view === "now" && hasNowHero) ||
    (view === "mine" && hasSavedEvents)
  );
}

/** Keep normal empty screens still while letting enlarged text remain reachable. */
export function canScrollSchedule(
  hasRows: boolean,
  fontScale: number,
): boolean {
  return hasRows || fontScale > 1;
}
