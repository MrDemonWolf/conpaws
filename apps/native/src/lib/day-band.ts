/**
 * Alternating background for blocks of events that overlap in time, so
 * everything running together reads as one visual cluster and the shade flips
 * when a genuinely new block starts — the "eight things all around 7:00 PM"
 * problem.
 *
 * The two classes are the existing `background` and `card` tokens, never raw
 * hex: on iOS both resolve to PlatformColor (systemBackground and
 * tertiarySystemBackground), so the bands keep tracking dark-elevated and
 * Increase Contrast the way every other surface does. A hex band would
 * override that and freeze the row background.
 */
export function timeSlotBandClass(slotIndex: number): string {
  return slotIndex % 2 === 1 ? "bg-card" : "bg-background";
}

/**
 * An event with no end time is treated as an hour long — the same fallback
 * the personal schedule uses for "still running".
 */
const NO_END_FALLBACK_MS = 60 * 60 * 1000;

/**
 * Per-row band indices for a day's events: an event that overlaps the block
 * before it joins that block; the index advances only when an event starts
 * after everything before it has ended. Assumes start-time order, which both
 * day-grouped lists guarantee.
 */
export function timeSlotBands(
  events: readonly { startTime: string; endTime?: string | null }[],
): number[] {
  let slot = 0;
  let blockEndMs = Number.NEGATIVE_INFINITY;

  return events.map((event) => {
    const startMs = Date.parse(event.startTime);
    const endMs = event.endTime
      ? Date.parse(event.endTime)
      : startMs + NO_END_FALLBACK_MS;

    if (startMs >= blockEndMs) {
      // Nothing from the previous block is still running: new cluster.
      if (blockEndMs !== Number.NEGATIVE_INFINITY) slot++;
      blockEndMs = endMs;
    } else {
      blockEndMs = Math.max(blockEndMs, endMs);
    }
    return slot;
  });
}
