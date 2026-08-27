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
export function shouldBounceSchedule(sections: { length: number }): boolean {
  return sections.length > 0;
}
