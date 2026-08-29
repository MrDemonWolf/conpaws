/**
 * Overlap grouping for a day's events: events whose times chain together
 * (each starts before everything earlier has ended) form one cluster, and the
 * rows of a cluster render as a visually grouped block — tinted background,
 * accent edge, and a "N events at the same time" header on the first row.
 * This replaced the old alternating background bands: the tint now means
 * "these events overlap", not merely "a new block started".
 *
 * SectionList constraint: rows are independent virtualized items, so a
 * cluster cannot be one wrapper view. Instead every row carries its position
 * (first/middle/last) and draws its own share of the group chrome.
 */

/**
 * An event with no end time is treated as an hour long — the same fallback
 * the personal schedule uses for "still running".
 */
const NO_END_FALLBACK_MS = 60 * 60 * 1000;

export type ClusterPosition = "solo" | "first" | "middle" | "last";

export interface OverlapInfo {
  /** Where this row sits in its overlap cluster; "solo" = nothing overlaps. */
  position: ClusterPosition;
  /** Total events in this row's cluster (1 for solo rows). */
  clusterSize: number;
  /** Exact number of other events whose time range intersects this one. */
  overlapCount: number;
}

/**
 * Per-row overlap grouping for a day's events. Assumes start-time order,
 * which both day-grouped lists guarantee.
 */
export function overlapInfo(
  events: readonly { startTime: string; endTime?: string | null }[],
): OverlapInfo[] {
  const times = events.map((event) => {
    const start = Date.parse(event.startTime);
    const end = event.endTime
      ? Date.parse(event.endTime)
      : start + NO_END_FALLBACK_MS;
    return { start, end };
  });

  const result: OverlapInfo[] = [];
  let clusterStart = 0;
  let blockEndMs = Number.NEGATIVE_INFINITY;

  const closeCluster = (endIndex: number) => {
    const size = endIndex - clusterStart;
    for (let i = clusterStart; i < endIndex; i++) {
      result[i].clusterSize = size;
      result[i].position =
        size === 1
          ? "solo"
          : i === clusterStart
            ? "first"
            : i === endIndex - 1
              ? "last"
              : "middle";
    }
  };

  times.forEach((time, index) => {
    if (time.start >= blockEndMs) {
      // Nothing from the previous cluster is still running: close it out.
      closeCluster(index);
      clusterStart = index;
      blockEndMs = time.end;
    } else {
      blockEndMs = Math.max(blockEndMs, time.end);
    }

    // ponytail: O(n²) intersection count — day lists are small; sweep if a
    // convention day ever gets big enough to matter.
    let overlapCount = 0;
    for (let j = 0; j < times.length; j++) {
      if (j === index) continue;
      if (times[j].start < time.end && time.start < times[j].end) {
        overlapCount++;
      }
    }

    result.push({ position: "solo", clusterSize: 1, overlapCount });
  });
  closeCluster(times.length);

  return result;
}

const SOLO: OverlapInfo = { position: "solo", clusterSize: 1, overlapCount: 0 };

/**
 * `overlapInfo`, but computed only among the events the predicate accepts;
 * every other row comes back solo. The convention screen groups only starred
 * events this way — on a dense con day almost everything overlaps something,
 * so grouping all events tinted whole days into one meaningless block. A
 * clash only matters between panels the user actually saved.
 */
export function overlapInfoAmong<
  T extends { startTime: string; endTime?: string | null },
>(events: readonly T[], include: (event: T) => boolean): OverlapInfo[] {
  const included = events.filter(include);
  const info = overlapInfo(included);
  let next = 0;
  return events.map((event) => (include(event) ? info[next++] : SOLO));
}
