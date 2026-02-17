import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "../client";
import { conventionEvents } from "../schema";
import type { ConventionEvent, NewConventionEvent } from "@/types";

export async function getEventsByConventionId(
  conventionId: string,
): Promise<ConventionEvent[]> {
  return db
    .select()
    .from(conventionEvents)
    .where(eq(conventionEvents.conventionId, conventionId))
    .all();
}

export async function getEventById(
  id: string,
): Promise<ConventionEvent | undefined> {
  const results = await db
    .select()
    .from(conventionEvents)
    .where(eq(conventionEvents.id, id));
  return results[0];
}

export async function createEvent(
  data: Omit<NewConventionEvent, "id" | "createdAt" | "updatedAt">,
): Promise<ConventionEvent> {
  const now = new Date().toISOString();
  const event: NewConventionEvent = {
    id: uuid(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(conventionEvents).values(event);
  return event as ConventionEvent;
}

export async function bulkCreateEvents(
  events: Omit<NewConventionEvent, "id" | "createdAt" | "updatedAt">[],
): Promise<ConventionEvent[]> {
  const now = new Date().toISOString();
  const created: ConventionEvent[] = [];

  for (const data of events) {
    const event: NewConventionEvent = {
      id: uuid(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(conventionEvents).values(event);
    created.push(event as ConventionEvent);
  }

  return created;
}

export async function updateEvent(
  id: string,
  data: Partial<
    Pick<
      ConventionEvent,
      | "title"
      | "description"
      | "startTime"
      | "endTime"
      | "location"
      | "room"
      | "category"
      | "contentWarning"
      | "isAgeRestricted"
    >
  >,
): Promise<void> {
  await db
    .update(conventionEvents)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(conventionEvents.id, id));
}

export async function deleteEvent(id: string): Promise<void> {
  await db.delete(conventionEvents).where(eq(conventionEvents.id, id));
}

export async function toggleSchedule(
  id: string,
  isInSchedule: boolean,
): Promise<void> {
  await db
    .update(conventionEvents)
    .set({ isInSchedule, updatedAt: new Date().toISOString() })
    .where(eq(conventionEvents.id, id));
}

export async function setReminder(
  id: string,
  reminderMinutes: number | null,
): Promise<void> {
  await db
    .update(conventionEvents)
    .set({ reminderMinutes, updatedAt: new Date().toISOString() })
    .where(eq(conventionEvents.id, id));
}

export async function getEventBySourceUid(
  conventionId: string,
  sourceUid: string,
): Promise<ConventionEvent | undefined> {
  const results = await db
    .select()
    .from(conventionEvents)
    .where(
      and(
        eq(conventionEvents.conventionId, conventionId),
        eq(conventionEvents.sourceUid, sourceUid),
      ),
    );
  return results[0];
}
