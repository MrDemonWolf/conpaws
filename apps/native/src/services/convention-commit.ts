import type { Convention, NewConvention } from "@/db/schema";
import { reportError } from "@/lib/error-reporting";

/**
 * The order in which a convention write is followed through, kept out of the
 * route components that trigger it.
 *
 * The ordering is the whole point. The Home Screen widget and the watch build
 * their snapshot by reading the database, so a snapshot published before the
 * write commits ships the state from before the user's edit and stays wrong
 * until something else happens to republish it. Living in a route component,
 * that sequence could only be checked by reading the source; as plain async
 * functions it can be asserted directly.
 *
 * Every dependency is passed in, so there is no React, no navigation and no
 * `Alert` here. The caller decides what to show and where to go once it has
 * the outcome.
 */

/** The columns a convention row is written with; the repository adds the rest. */
export type ConventionDraft = Omit<
  NewConvention,
  "id" | "createdAt" | "updatedAt"
>;

/** A partial write against a convention row that already exists. */
export type ConventionPatch = Partial<Omit<NewConvention, "id" | "createdAt">>;

export type ConventionCommitOutcome =
  | { ok: true; conventionId: string }
  | { ok: false; reason: "write-failed" };

export interface NewConventionCommitDeps {
  create: (draft: ConventionDraft) => Promise<Convention>;
  /**
   * Puts the written row, and its still-empty event list, straight into the
   * read cache the detail screen mounts against.
   */
  seedCaches: (convention: Convention) => void;
  invalidateList: () => Promise<unknown>;
  publishSnapshot: () => Promise<unknown>;
  haptic: () => void;
}

export interface ConventionUpdateCommitDeps {
  update: (conventionId: string, patch: ConventionPatch) => Promise<void>;
  refreshCaches: (conventionId: string) => Promise<unknown>;
  publishSnapshot: () => Promise<unknown>;
  haptic: () => void;
}

/**
 * Writes a new convention and brings everything that reads conventions back
 * into agreement with it.
 *
 * Resolves only once the snapshot has been rebuilt, so a caller that navigates
 * on the result cannot leave the screen while the widget still holds the old
 * list.
 */
export async function commitNewConvention(
  draft: ConventionDraft,
  deps: NewConventionCommitDeps,
): Promise<ConventionCommitOutcome> {
  let convention: Convention;
  try {
    convention = await deps.create(draft);
  } catch (error) {
    // The caller only ever shows a generic "could not save" alert, so without
    // this the one failure that loses a user's typing is invisible to us.
    reportError(error, { scope: "convention-commit.create" });
    return { ok: false, reason: "write-failed" };
  }

  deps.seedCaches(convention);
  deps.haptic();
  await deps.invalidateList();
  // A snapshot that cannot be published is not a reason to fail a save the
  // database already accepted.
  await deps.publishSnapshot().catch(() => false);

  return { ok: true, conventionId: convention.id };
}

/**
 * Applies an edit to an existing convention, then republishes everything that
 * had been reading the old row.
 */
export async function commitConventionUpdate(
  conventionId: string,
  patch: ConventionPatch,
  deps: ConventionUpdateCommitDeps,
): Promise<ConventionCommitOutcome> {
  try {
    await deps.update(conventionId, patch);
  } catch (error) {
    reportError(error, { scope: "convention-commit.update" });
    return { ok: false, reason: "write-failed" };
  }

  deps.haptic();
  await deps.refreshCaches(conventionId);
  await deps.publishSnapshot().catch(() => false);

  return { ok: true, conventionId };
}

/** A flag that outlives renders, so a second tap sees the first one's claim. */
export interface SaveLock {
  current: boolean;
}

export interface ConventionEditSaveSteps {
  /**
   * Settles the zone to save with. It may geocode for seconds or ask the
   * user; null means they went to pick a zone by hand, so nothing is written.
   */
  resolveTimeZone: () => Promise<string | null>;
  /** Writes the edit with that zone; null means the values no longer validate. */
  commit: (timeZone: string) => Promise<ConventionCommitOutcome | null>;
  /** False once the form has closed. */
  isMounted: () => boolean;
  setSaving: (saving: boolean) => void;
  onWriteFailed: () => void;
  /** Closes the form; called at most once, and only while it is still open. */
  leave: () => void;
}

/**
 * Runs the edit form's Save: resolve the zone, write, then leave.
 *
 * The form is locked before the zone is resolved, not after. Resolving a
 * changed location's zone is a geocode that can take seconds, and a form left
 * live across it let a second Save write twice and call back() twice -- the
 * second one popping the convention screen too. A form closed mid-way (Cancel
 * and Discard, or a swipe down) writes nothing it has not already started
 * writing, and never navigates from a screen that is already gone.
 */
export async function saveConventionEdit(
  lock: SaveLock,
  steps: ConventionEditSaveSteps,
): Promise<void> {
  if (lock.current) return;
  lock.current = true;
  steps.setSaving(true);

  const unlock = () => {
    lock.current = false;
    if (steps.isMounted()) steps.setSaving(false);
  };

  const timeZone = await steps.resolveTimeZone();
  if (!timeZone) {
    unlock();
    return;
  }
  if (!steps.isMounted()) return;

  const outcome = await steps.commit(timeZone);
  if (!outcome) {
    unlock();
    return;
  }
  if (!outcome.ok) {
    unlock();
    steps.onWriteFailed();
    return;
  }
  if (steps.isMounted()) steps.leave();
}
