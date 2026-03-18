import { eq } from 'drizzle-orm';
import { db } from '../index';
import { conventions, type Convention, type NewConvention } from '../schema';

function generateId(): string {
  return 'conv_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function getAll(): Promise<Convention[]> {
  return db.select().from(conventions).orderBy(conventions.startDate);
}

export async function getById(id: string): Promise<Convention | undefined> {
  const results = await db.select().from(conventions).where(eq(conventions.id, id));
  return results[0];
}

export async function create(data: Omit<NewConvention, 'id' | 'createdAt' | 'updatedAt'>): Promise<Convention> {
  const now = new Date().toISOString();
  const id = generateId();
  await db.insert(conventions).values({ ...data, id, createdAt: now, updatedAt: now });
  return (await getById(id))!;
}

export async function update(id: string, data: Partial<Omit<NewConvention, 'id' | 'createdAt'>>): Promise<void> {
  await db
    .update(conventions)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(conventions.id, id));
}

export async function remove(id: string): Promise<void> {
  await db.delete(conventions).where(eq(conventions.id, id));
}
