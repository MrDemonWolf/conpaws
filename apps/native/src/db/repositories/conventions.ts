import { eq } from "drizzle-orm";
import { db } from "../index";
import { type Convention, conventions, type NewConvention } from "../schema";

function generateId(): string {
  return `conv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export async function getAll(): Promise<Convention[]> {
  return db.select().from(conventions).orderBy(conventions.startDate);
}

export async function getById(id: string): Promise<Convention | undefined> {
  const results = await db
    .select()
    .from(conventions)
    .where(eq(conventions.id, id));
  return results[0];
}

export async function create(
  data: Omit<NewConvention, "id" | "createdAt" | "updatedAt">,
): Promise<Convention> {
  const now = new Date().toISOString();
  const id = generateId();
  await db
    .insert(conventions)
    .values({ ...data, id, createdAt: now, updatedAt: now });
  const created = await getById(id);
  if (!created) {
    // The insert resolved without throwing, so a missing row here means the
    // write did not land. Failing is better than handing the caller something
    // typed Convention that is actually undefined.
    throw new Error(`Convention ${id} could not be read back after insert`);
  }
  return created;
}

export async function update(
  id: string,
  data: Partial<Omit<NewConvention, "id" | "createdAt">>,
): Promise<void> {
  await db
    .update(conventions)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(conventions.id, id));
}

export async function remove(id: string): Promise<void> {
  await db.delete(conventions).where(eq(conventions.id, id));
}

export async function archive(id: string): Promise<void> {
  await update(id, { archivedAt: new Date().toISOString() });
}
