/**
 * Presentation rules shared by the two day-grouped schedule lists.
 *
 * Content styles first: an empty panel has to fill the viewport so its
 * centred message stays centred, and a populated list needs its own bottom
 * padding or the last row of the last day runs under the system navigation
 * bar.
 */
export const SCHEDULE_EMPTY_CONTENT_STYLE = { flexGrow: 1 } as const;

export const SCHEDULE_LIST_CONTENT_STYLE = { paddingBottom: 24 } as const;

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
 */
export function showsScheduleHeader(
  view: "all" | "mine" | "now",
  rowCount: number,
  hasNowHero: boolean,
): boolean {
  return view === "all" || rowCount > 0 || (view === "now" && hasNowHero);
}

/** Keep normal empty screens still while letting enlarged text remain reachable. */
export function canScrollSchedule(
  hasRows: boolean,
  fontScale: number,
): boolean {
  return hasRows || fontScale > 1;
}
