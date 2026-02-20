import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { db } from "../client";
import { conventions } from "../schema";
import { getConventionStatus } from "@/lib/date-utils";
import type { Convention, NewConvention } from "@/types";

export async function getAllConventions(): Promise<Convention[]> {
  return db.select().from(conventions).all();
}

export async function getConventionById(
  id: string,
): Promise<Convention | undefined> {
  const results = await db
    .select()
    .from(conventions)
    .where(eq(conventions.id, id));
  return results[0];
}

export async function createConvention(
  data: Omit<NewConvention, "id" | "createdAt" | "updatedAt" | "status">,
): Promise<Convention> {
  const now = new Date().toISOString();
  const convention: NewConvention = {
    id: uuid(),
    ...data,
    status: getConventionStatus(data.startDate, data.endDate),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(conventions).values(convention);
  return convention as Convention;
}

export async function updateConvention(
  id: string,
  data: Partial<Pick<Convention, "name" | "startDate" | "endDate" | "icalUrl">>,
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { ...data, updatedAt: now };

  if (data.startDate || data.endDate) {
    const existing = await getConventionById(id);
    if (existing) {
      updates.status = getConventionStatus(
        data.startDate ?? existing.startDate,
        data.endDate ?? existing.endDate,
      );
    }
  }

  await db.update(conventions).set(updates).where(eq(conventions.id, id));
}

export async function deleteConvention(id: string): Promise<void> {
  await db.delete(conventions).where(eq(conventions.id, id));
}

export async function updateConventionStatuses(): Promise<void> {
  const all = await getAllConventions();
  for (const con of all) {
    const newStatus = getConventionStatus(con.startDate, con.endDate);
    if (newStatus !== con.status) {
      await db
        .update(conventions)
        .set({ status: newStatus, updatedAt: new Date().toISOString() })
        .where(eq(conventions.id, con.id));
    }
  }
}
