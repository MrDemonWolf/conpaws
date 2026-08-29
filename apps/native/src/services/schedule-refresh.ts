import * as eventsRepo from "@/db/repositories/events";
import type { Convention } from "@/db/schema";
import { type ImportResult, runScheduleImport } from "@/hooks/useImportSchedule";
import { reportError } from "@/lib/error-reporting";
import { parseIcs } from "@/lib/ical-parser";
import {
  type ScheduleChangeSummary,
  summarizeScheduleChanges,
} from "@/lib/schedule-changes";
import {
  getScheduleAllCategories,
  getScheduleAutoCheck,
  getScheduleCheckedAt,
  SCHEDULE_CHECK_INTERVAL_MS,
  setScheduleCheckedAt,
} from "@/lib/schedule-refresh-storage";
import { toSourceSnapshot } from "@/lib/schedule-source";
import { fetchScheduleIcs } from "@/lib/sched-extractor";
import { publishWidgetSnapshot } from "@/services/widget-snapshot";

/**
 * Re-reads a convention's saved feed and applies what it finds.
 *
 * The design rule this file exists to enforce: **a check the user did not ask
 * for never speaks unless it has something worth saying.** No error banners, no
 * spinners, no "couldn't reach the schedule" on convention wifi — a failed
 * background check is indistinguishable from no check at all. Only a check the
 * user pressed for is allowed to report a failure, and it does that at the call
 * site, not here.
 *
 * Changes are applied rather than queued behind a review. A review would be
 * false agency: the panel moved whether or not the user taps Apply, and the
 * only real question — "did I lose something I saved?" — is answered by the
 * tombstones in `planSourceReconciliation`, not by a diff screen.
 */

export type ScheduleRefreshResult =
  /** A gate said no. Nothing happened and nothing is shown. */
  | { status: "skipped" }
  /** The feed was read and matches. Worth saying, quietly. */
  | { status: "unchanged"; checkedAt: number }
  | { status: "applied"; checkedAt: number; summary: ScheduleChangeSummary }
  /**
   * The feed parsed but could not be trusted — empty, or nothing in it matched
   * what we hold, or too much of the schedule vanished at once. Deliberately
   * indistinguishable from `skipped` on screen: claiming "checked" would imply
   * "and it is fine", which is exactly what is not known.
   */
  | { status: "untrusted"; checkedAt: number }
  /** Offline, timed out, moved, or unparseable. Silent by construction. */
  | { status: "failed" };

export interface ScheduleRefreshDeps {
  /** Invalidates the react-query keys the schedule screens read. */
  refreshCaches: (conventionId: string) => Promise<unknown>;
}

export interface ScheduleRefreshOptions {
  /**
   * Set when the user pressed for this. Skips the throttle only — every safety
   * gate still applies, because "I asked for it" is not evidence that a feed
   * returning one event means the convention cancelled everything else.
   */
  force?: boolean;
  now?: number;
}

export async function refreshConventionSchedule(
  convention: Convention,
  deps: ScheduleRefreshDeps,
  options: ScheduleRefreshOptions = {},
): Promise<ScheduleRefreshResult> {
  const { force = false, now = Date.now() } = options;

  if (!convention.icalUrl) return { status: "skipped" };
  // An ended or archived convention's feed is not news, and a convention the
  // user filed away should not be reaching the network.
  if (convention.status === "ended" || convention.archivedAt !== null) {
    return { status: "skipped" };
  }
  if (!force && !(await getScheduleAutoCheck())) return { status: "skipped" };

  if (!force) {
    const checkedAt = await getScheduleCheckedAt(convention.id);
    if (checkedAt !== null && now - checkedAt < SCHEDULE_CHECK_INTERVAL_MS) {
      return { status: "skipped" };
    }
  }

  // Without the full category set on the last import there is no record of
  // what the user chose to leave out, and applying the feed wholesale would
  // quietly reinstate it. See `getScheduleAllCategories`.
  if (!(await getScheduleAllCategories(convention.id))) {
    return { status: "skipped" };
  }

  try {
    const fetched = await fetchScheduleIcs(convention.icalUrl);
    const parsed = parseIcs(fetched.icsContent, {
      timeZone: convention.timeZone ?? undefined,
    });

    // A feed with no zone of its own needs one supplied. Guessing would shift
    // every event and report the whole schedule as moved.
    if (parsed.requiresTimeZone) return { status: "failed" };

    const stored = await eventsRepo.getByConventionId(convention.id);
    const outcome = summarizeScheduleChanges(
      stored,
      parsed.events.map((event) => ({
        sourceUid: event.sourceUid,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime?.toISOString() ?? null,
        room: event.room,
        location: event.location,
        isInSchedule: false,
      })),
      parsed.cancelledSourceUids,
    );

    if (outcome.status === "untrusted") {
      // Stamped anyway: a feed that is broken now will still be broken in
      // thirty seconds, and re-fetching it on every glance helps nobody.
      await setScheduleCheckedAt(convention.id, now);
      return { status: "untrusted", checkedAt: now };
    }

    if (outcome.status === "unchanged") {
      await setScheduleCheckedAt(convention.id, now);
      return { status: "unchanged", checkedAt: now };
    }

    let result: ImportResult;
    try {
      result = await runScheduleImport({
        parsedEvents: parsed.events,
        conventionId: convention.id,
        sourceSnapshot: toSourceSnapshot(parsed, true),
      });
    } catch (error) {
      // The write failed, so nothing is claimed. No stamp either: the next
      // glance should try again rather than wait out the interval.
      reportError(error, { scope: "schedule-refresh.apply" });
      return { status: "failed" };
    }

    await setScheduleCheckedAt(convention.id, now);
    // The widget and Watch read the events this just rewrote, and the caller's
    // cache invalidation is what redraws the screen underneath the user.
    await publishWidgetSnapshot().catch(() => false);
    await deps.refreshCaches(convention.id);

    return {
      status: "applied",
      checkedAt: now,
      summary: {
        ...outcome.summary,
        // The planner is the authority on what actually went. It resolves
        // series identities the flat comparison cannot see, so its count is
        // the one the user is shown.
        savedGone: result.tombstoned,
      },
    };
  } catch (error) {
    reportError(error, { scope: "schedule-refresh.check" });
    return { status: "failed" };
  }
}
