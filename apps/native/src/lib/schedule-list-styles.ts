/**
 * Content styles shared by the two day-grouped schedule lists.
 *
 * One rule, written once: an empty panel has to fill the viewport so its
 * centred message stays centred, and a populated list needs its own bottom
 * padding or the last row of the last day runs under the system navigation
 * bar.
 */
export const SCHEDULE_EMPTY_CONTENT_STYLE = { flexGrow: 1 } as const;

export const SCHEDULE_LIST_CONTENT_STYLE = { paddingBottom: 24 } as const;
