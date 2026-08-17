import { eq, inArray } from "drizzle-orm";
import { db } from "../index";
import {
  type ConventionEvent,
  conventionEvents,
  type NewConventionEvent,
} from "../schema";

function generateId(): string {
  return (
    "evt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  );
}

export async function getByConventionId(
  conventionId: string,
): Promise<ConventionEvent[]> {
  return db
    .select()
    .from(conventionEvents)
    .where(eq(conventionEvents.conventionId, conventionId))
    .orderBy(conventionEvents.startTime);
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
}

export async function upsertBySourceUid(
  events: Omit<NewConventionEvent, "id" | "createdAt" | "updatedAt">[],
  conventionId: string,
): Promise<UpsertResult> {
  if (events.length === 0) return { added: 0, updated: 0 };

  const existing = await db
    .select()
    .from(conventionEvents)
    .where(eq(conventionEvents.conventionId, conventionId));

  const existingByUid = new Map(existing.map((e) => [e.sourceUid, e]));

  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const event of events) {
    const uid = event.sourceUid;
    const existingEvent = uid ? existingByUid.get(uid) : undefined;

    if (existingEvent) {
      // Preserve user state: isInSchedule and reminderMinutes
      await db
        .update(conventionEvents)
        .set({
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          room: event.room,
          category: event.category,
          type: event.type,
          sourceUrl: event.sourceUrl,
          isAgeRestricted: event.isAgeRestricted,
          contentWarning: event.contentWarning,
          updatedAt: now,
        })
        .where(eq(conventionEvents.id, existingEvent.id));
      updated++;
    } else {
      await db.insert(conventionEvents).values({
        ...event,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }
  }

  return { added, updated };
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
