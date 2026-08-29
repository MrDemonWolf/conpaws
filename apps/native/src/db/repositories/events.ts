import { eq, isNotNull } from "drizzle-orm";
import { db } from "../index";
import {
  type ConventionEvent,
  conventionEvents,
  conventions,
  type NewConventionEvent,
} from "../schema";

function generateId(): string {
  return `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export async function getByConventionId(
  conventionId: string,
): Promise<ConventionEvent[]> {
  return db
    .select()
    .from(conventionEvents)
    .where(eq(conventionEvents.conventionId, conventionId))
    .orderBy(
      conventionEvents.startTime,
      conventionEvents.room,
      conventionEvents.title,
      conventionEvents.id,
    );
}

export async function getById(
  id: string,
): Promise<ConventionEvent | undefined> {
  const results = await db
    .select()
    .from(conventionEvents)
    .where(eq(conventionEvents.id, id));
  return results[0];
}

export async function batchInsert(
  events: Omit<NewConventionEvent, "id" | "createdAt" | "updatedAt">[],
): Promise<void> {
  if (events.length === 0) return;
  const now = new Date().toISOString();
  const rows = events.map((e) => ({
    ...e,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(conventionEvents).values(rows);
}

export interface UpsertResult {
  added: number;
  updated: number;
  identityUpdated: number;
  removedEventIds: string[];
  /**
   * Saved events the feed dropped. They are still in the table, marked — but
   * their reminders must be cancelled, which happens outside the transaction.
   */
  tombstonedEventIds: string[];
  unresolvedSeries: string[];
}

export type SourceEventInput = Omit<
  NewConventionEvent,
  "id" | "createdAt" | "updatedAt"
> & {
  legacySourceUid?: string | null;
};

export interface SourceOccurrenceIdentity {
  sourceUid: string;
  legacySourceUid: string | null;
  startTime: string | null;
  recurrenceTime: string | null;
  title: string | null;
  sourceUrl: string | null;
}

export interface SourceSnapshot {
  activeOccurrences: SourceOccurrenceIdentity[];
  cancelledOccurrences: SourceOccurrenceIdentity[];
  authoritative: boolean;
}

interface PlannedUpdate {
  existingId: string;
  event: SourceEventInput;
}

export interface PlannedIdentityUpdate {
  existingId: string;
  sourceUid: string;
}

export type FeedStatus = "cancelled" | "removed";

/**
 * An event the user saved that the feed stopped publishing.
 *
 * It is deliberately not a removal. Deleting it would take the user's own
 * decision with it — the star, the reminder, and any memory that the panel was
 * ever on the schedule — on nothing more than one fetch of a file we do not
 * control. Marking the row keeps the answer to "wasn't there something at
 * three?" on screen, where the question gets asked.
 */
export interface PlannedTombstone {
  existingId: string;
  status: FeedStatus;
}

export interface SourceReconciliationPlan {
  inserts: SourceEventInput[];
  updates: PlannedUpdate[];
  identityUpdates: PlannedIdentityUpdate[];
  removals: ConventionEvent[];
  /** Saved events the feed dropped. Marked in place rather than deleted. */
  tombstones: PlannedTombstone[];
  unresolvedSeries: string[];
}

interface SeriesGroup {
  baseUid: string;
  active: Map<string, SourceOccurrenceIdentity>;
  cancelled: Map<string, SourceOccurrenceIdentity>;
}

function identityBase(identity: SourceOccurrenceIdentity): string {
  return identity.legacySourceUid ?? identity.sourceUid;
}

function matchesOccurrenceTime(
  event: ConventionEvent,
  identity: SourceOccurrenceIdentity,
): boolean {
  return (
    event.startTime === identity.startTime ||
    event.startTime === identity.recurrenceTime
  );
}

function byStartTimeThenId(
  left: ConventionEvent,
  right: ConventionEvent,
): number {
  return (
    left.startTime.localeCompare(right.startTime) ||
    left.id.localeCompare(right.id)
  );
}

function sameSeries(sourceUid: string, baseUid: string): boolean {
  return sourceUid === baseUid || sourceUid.startsWith(`${baseUid}|`);
}

export function planSourceReconciliation(
  existing: ConventionEvent[],
  events: SourceEventInput[],
  snapshot: SourceSnapshot,
): SourceReconciliationPlan {
  const selectedByUid = new Map<string, SourceEventInput>();
  for (const event of events) {
    if (event.sourceUid) selectedByUid.set(event.sourceUid, event);
  }

  const cancelledByUid = new Map(
    snapshot.cancelledOccurrences.map((identity) => [
      identity.sourceUid,
      identity,
    ]),
  );
  const activeByUid = new Map<string, SourceOccurrenceIdentity>();
  for (const identity of snapshot.activeOccurrences) {
    if (!cancelledByUid.has(identity.sourceUid)) {
      activeByUid.set(identity.sourceUid, identity);
    }
  }
  for (const event of selectedByUid.values()) {
    const sourceUid = event.sourceUid;
    if (
      !sourceUid ||
      activeByUid.has(sourceUid) ||
      cancelledByUid.has(sourceUid)
    ) {
      continue;
    }
    activeByUid.set(sourceUid, {
      sourceUid,
      legacySourceUid: event.legacySourceUid ?? null,
      startTime: event.startTime,
      recurrenceTime: null,
      title: event.title,
      sourceUrl: event.sourceUrl ?? null,
    });
  }

  const groups = new Map<string, SeriesGroup>();
  function getGroup(identity: SourceOccurrenceIdentity): SeriesGroup {
    const baseUid = identityBase(identity);
    let group = groups.get(baseUid);
    if (!group) {
      group = {
        baseUid,
        active: new Map(),
        cancelled: new Map(),
      };
      groups.set(baseUid, group);
    }
    return group;
  }
  for (const identity of activeByUid.values()) {
    getGroup(identity).active.set(identity.sourceUid, identity);
  }
  for (const identity of cancelledByUid.values()) {
    getGroup(identity).cancelled.set(identity.sourceUid, identity);
  }

  const sourceRows = existing
    .filter(
      (event): event is ConventionEvent & { sourceUid: string } =>
        event.sourceUid !== null,
    )
    .sort(byStartTimeThenId);
  const inserts: SourceEventInput[] = [];
  const updates: PlannedUpdate[] = [];
  const identityUpdates: PlannedIdentityUpdate[] = [];
  const removalsById = new Map<string, ConventionEvent>();
  const tombstonesById = new Map<string, PlannedTombstone>();
  const handledIds = new Set<string>();
  const protectedIds = new Set<string>();
  const unresolvedSeries: string[] = [];

  /**
   * The one choke point every disappearance passes through.
   *
   * An event the user saved is marked, not deleted — see `PlannedTombstone`.
   * Everything else is still dropped, because a schedule that kept every panel
   * a convention ever published would be unreadable within a day.
   */
  function addRemoval(event: ConventionEvent, status: FeedStatus): void {
    if (event.isInSchedule) {
      tombstonesById.set(event.id, { existingId: event.id, status });
    } else {
      removalsById.set(event.id, event);
    }
    handledIds.add(event.id);
  }

  for (const group of Array.from(groups.values()).sort((left, right) =>
    left.baseUid.localeCompare(right.baseUid),
  )) {
    const identities = [...group.active.values(), ...group.cancelled.values()];
    const knownSourceUids = new Set(
      identities.map((identity) => identity.sourceUid),
    );
    const hasSeriesTombstone = Array.from(group.cancelled.values()).some(
      (identity) => identity.legacySourceUid === null,
    );
    const groupExisting = sourceRows.filter(
      (event) =>
        event.sourceUid === group.baseUid ||
        knownSourceUids.has(event.sourceUid) ||
        (hasSeriesTombstone && sameSeries(event.sourceUid, group.baseUid)),
    );

    if (hasSeriesTombstone) {
      for (const event of sourceRows) {
        if (sameSeries(event.sourceUid, group.baseUid))
          addRemoval(event, "cancelled");
      }
      continue;
    }

    const work = [...group.active.values(), ...group.cancelled.values()];
    const assignments = new Map<string, ConventionEvent>();
    const claimedIds = new Set<string>();
    const bareRows = groupExisting.filter(
      (event) => event.sourceUid === group.baseUid,
    );
    let ambiguous = false;

    if (
      work.length === 1 &&
      work[0].legacySourceUid === null &&
      work[0].sourceUid === group.baseUid &&
      bareRows.length === 1
    ) {
      assignments.set(work[0].sourceUid, bareRows[0]);
      claimedIds.add(bareRows[0].id);
    }

    for (const identity of work) {
      if (identity.sourceUid === group.baseUid) continue;
      const exactRows = groupExisting.filter(
        (event) =>
          event.sourceUid === identity.sourceUid && !claimedIds.has(event.id),
      );
      if (exactRows.length === 1) {
        assignments.set(identity.sourceUid, exactRows[0]);
        claimedIds.add(exactRows[0].id);
      } else if (exactRows.length > 1) {
        const evidenced = exactRows.filter((event) =>
          matchesOccurrenceTime(event, identity),
        );
        if (evidenced.length === 1) {
          assignments.set(identity.sourceUid, evidenced[0]);
          claimedIds.add(evidenced[0].id);
        } else {
          ambiguous = true;
        }
      }
    }

    while (!ambiguous) {
      const pending = work.filter(
        (identity) => !assignments.has(identity.sourceUid),
      );
      const available = bareRows.filter((event) => !claimedIds.has(event.id));
      const candidatesByUid = new Map<string, ConventionEvent[]>();
      const candidateCountByEventId = new Map<string, number>();

      for (const identity of pending) {
        const candidates = available.filter((event) =>
          matchesOccurrenceTime(event, identity),
        );
        candidatesByUid.set(identity.sourceUid, candidates);
        for (const candidate of candidates) {
          candidateCountByEventId.set(
            candidate.id,
            (candidateCountByEventId.get(candidate.id) ?? 0) + 1,
          );
        }
      }

      const uniqueMatches = pending
        .map((identity) => ({
          identity,
          candidates: candidatesByUid.get(identity.sourceUid) ?? [],
        }))
        .filter(
          ({ candidates }) =>
            candidates.length === 1 &&
            candidateCountByEventId.get(candidates[0].id) === 1,
        );
      if (uniqueMatches.length === 0) break;

      for (const { identity, candidates } of uniqueMatches) {
        assignments.set(identity.sourceUid, candidates[0]);
        claimedIds.add(candidates[0].id);
      }
    }

    let remainingWork = work.filter(
      (identity) => !assignments.has(identity.sourceUid),
    );
    let remainingBare = bareRows.filter((event) => !claimedIds.has(event.id));
    if (
      !ambiguous &&
      snapshot.authoritative &&
      remainingWork.length === 1 &&
      remainingBare.length === 1
    ) {
      assignments.set(remainingWork[0].sourceUid, remainingBare[0]);
      claimedIds.add(remainingBare[0].id);
      remainingWork = [];
      remainingBare = [];
    }

    if (!ambiguous && remainingWork.length > 0 && remainingBare.length > 0) {
      ambiguous = true;
    }

    if (ambiguous) {
      unresolvedSeries.push(group.baseUid);
      for (const event of sourceRows) {
        if (sameSeries(event.sourceUid, group.baseUid)) {
          protectedIds.add(event.id);
        }
      }
      continue;
    }

    for (const identity of group.active.values()) {
      const matched = assignments.get(identity.sourceUid);
      const selected = selectedByUid.get(identity.sourceUid);
      if (matched) {
        handledIds.add(matched.id);
        if (selected) {
          updates.push({ existingId: matched.id, event: selected });
        } else if (matched.sourceUid !== identity.sourceUid) {
          identityUpdates.push({
            existingId: matched.id,
            sourceUid: identity.sourceUid,
          });
        }
      } else if (selected) {
        inserts.push(selected);
      }
    }

    for (const identity of group.cancelled.values()) {
      const matched = assignments.get(identity.sourceUid);
      if (matched) addRemoval(matched, "cancelled");
    }

    if (snapshot.authoritative) {
      // Left over inside a group the feed still publishes: the occurrence is
      // gone rather than announced as cancelled, so it earns the weaker word.
      for (const event of remainingBare) addRemoval(event, "removed");
    }
  }

  if (snapshot.authoritative) {
    const activeSourceUids = new Set(activeByUid.keys());
    for (const event of sourceRows) {
      if (
        handledIds.has(event.id) ||
        protectedIds.has(event.id) ||
        removalsById.has(event.id)
      ) {
        continue;
      }
      if (!activeSourceUids.has(event.sourceUid)) addRemoval(event, "removed");
    }
  }

  return {
    inserts,
    updates,
    identityUpdates,
    removals: Array.from(removalsById.values()),
    tombstones: Array.from(tombstonesById.values()),
    unresolvedSeries: unresolvedSeries.sort(),
  };
}

export async function upsertBySourceUid(
  events: SourceEventInput[],
  conventionId: string,
  snapshot: SourceSnapshot,
): Promise<UpsertResult> {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(conventionEvents)
      .where(eq(conventionEvents.conventionId, conventionId))
      .all();
    const plan = planSourceReconciliation(existing, events, snapshot);
    const now = new Date().toISOString();

    for (const { existingId, event } of plan.updates) {
      tx.update(conventionEvents)
        .set({
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          room: event.room,
          category: event.category,
          type: event.type,
          sourceUid: event.sourceUid,
          sourceUrl: event.sourceUrl,
          isAgeRestricted: event.isAgeRestricted,
          ageRating: event.ageRating,
          contentWarning: event.contentWarning,
          // The feed is publishing this event again, so any mark it collected
          // while missing is stale. Feeds churn their identifiers routinely;
          // clearing here is what makes a tombstone recoverable instead of a
          // one-way door.
          feedStatus: null,
          updatedAt: now,
        })
        .where(eq(conventionEvents.id, existingId))
        .run();
    }
    for (const identityUpdate of plan.identityUpdates) {
      tx.update(conventionEvents)
        .set({
          sourceUid: identityUpdate.sourceUid,
          feedStatus: null,
          updatedAt: now,
        })
        .where(eq(conventionEvents.id, identityUpdate.existingId))
        .run();
    }
    for (const tombstone of plan.tombstones) {
      // `isInSchedule` and `reminderMinutes` are left alone on purpose: they
      // record what the user decided, and the user has not decided anything.
      // The OS notification is cancelled by the caller, outside this
      // transaction, so the row keeps the intent while nothing fires.
      tx.update(conventionEvents)
        .set({ feedStatus: tombstone.status, updatedAt: now })
        .where(eq(conventionEvents.id, tombstone.existingId))
        .run();
    }
    for (const event of plan.inserts) {
      const { legacySourceUid: _, ...row } = event;
      tx.insert(conventionEvents)
        .values({
          ...row,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    for (const event of plan.removals) {
      tx.delete(conventionEvents)
        .where(eq(conventionEvents.id, event.id))
        .run();
    }

    return {
      added: plan.inserts.length,
      updated: plan.updates.length,
      identityUpdated: plan.identityUpdates.length,
      removedEventIds: plan.removals.map((event) => event.id),
      tombstonedEventIds: plan.tombstones.map(
        (tombstone) => tombstone.existingId,
      ),
      unresolvedSeries: plan.unresolvedSeries,
    };
  });
}

export async function getAllWithReminders(): Promise<ConventionEvent[]> {
  return db
    .select()
    .from(conventionEvents)
    .where(isNotNull(conventionEvents.reminderMinutes));
}

export async function remove(id: string): Promise<void> {
  await db.delete(conventionEvents).where(eq(conventionEvents.id, id));
}

export async function update(
  id: string,
  data: Partial<Omit<NewConventionEvent, "id" | "createdAt">>,
): Promise<void> {
  await db
    .update(conventionEvents)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(conventionEvents.id, id));
}

export async function getIdsByConventionId(
  conventionId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: conventionEvents.id })
    .from(conventionEvents)
    .where(eq(conventionEvents.conventionId, conventionId));
  return rows.map((r) => r.id);
}

export interface SavedEventRow {
  event: ConventionEvent;
  conventionName: string;
  conventionTimeZone: string | null;
}

/**
 * Every starred event across every convention, for the Schedule tab.
 *
 * Joined rather than fetched per convention: the tab needs the convention's
 * name and time zone on each row, and the whole point is that the user has
 * more than one convention saved.
 */
export async function getAllInSchedule(): Promise<SavedEventRow[]> {
  const rows = await db
    .select({
      event: conventionEvents,
      conventionName: conventions.name,
      conventionTimeZone: conventions.timeZone,
    })
    .from(conventionEvents)
    .innerJoin(conventions, eq(conventionEvents.conventionId, conventions.id))
    .where(eq(conventionEvents.isInSchedule, true));

  return rows;
}
