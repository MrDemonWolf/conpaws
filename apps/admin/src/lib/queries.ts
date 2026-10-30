import { and, asc, count, desc, eq, like, ne, or } from "drizzle-orm";
import {
  adminInvites,
  adminMembers,
  auditLog,
  type Convention,
  conventionRevisions,
  conventions,
  type ScheduleEvent,
  scheduleEvents,
} from "../db/schema";
import { toPublicConvention } from "./catalog";
import { getCatalogDb } from "./db";

export async function getDashboardData() {
  const db = await getCatalogDb();
  const [published, drafts, sessions, members, recent, draftItems] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(conventions)
        .where(eq(conventions.status, "published")),
      db
        .select({ total: count() })
        .from(conventions)
        .where(eq(conventions.status, "draft")),
      db.select({ total: count() }).from(scheduleEvents),
      db
        .select({ total: count() })
        .from(adminMembers)
        .where(eq(adminMembers.status, "active")),
      // Overview lists changes; sign-ins stay on the Activity screen.
      db
        .select()
        .from(auditLog)
        .where(ne(auditLog.action, "admin.signed-in"))
        .orderBy(desc(auditLog.createdAt))
        .limit(6),
      db
        .select()
        .from(conventions)
        .where(eq(conventions.status, "draft"))
        .orderBy(asc(conventions.startsOn))
        .limit(3),
    ]);

  const upcoming = await db
    .select()
    .from(conventions)
    .where(eq(conventions.status, "published"))
    .orderBy(asc(conventions.startsOn))
    .limit(5);

  return {
    published: published[0]?.total ?? 0,
    drafts: drafts[0]?.total ?? 0,
    sessions: sessions[0]?.total ?? 0,
    members: members[0]?.total ?? 0,
    recent,
    upcoming,
    draftItems,
  };
}

export async function getConventions(
  input: { query?: string; status?: string } = {},
) {
  const db = await getCatalogDb();
  const conditions = [];
  const query = input.query?.trim();
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      or(
        like(conventions.name, pattern),
        like(conventions.acronym, pattern),
        like(conventions.city, pattern),
        like(conventions.region, pattern),
        like(conventions.country, pattern),
        like(conventions.slug, pattern),
      ),
    );
  }
  if (
    input.status === "draft" ||
    input.status === "published" ||
    input.status === "archived"
  ) {
    conditions.push(eq(conventions.status, input.status));
  }
  return db
    .select()
    .from(conventions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(conventions.startsOn), asc(conventions.name));
}

export async function getConventionWorkspace(id: string) {
  const db = await getCatalogDb();
  const [convention] = await db
    .select()
    .from(conventions)
    .where(eq(conventions.id, id))
    .limit(1);
  if (!convention) return null;

  const [sessions, revisions] = await Promise.all([
    db
      .select()
      .from(scheduleEvents)
      .where(eq(scheduleEvents.conventionId, id))
      .orderBy(asc(scheduleEvents.startsAt)),
    db
      .select()
      .from(conventionRevisions)
      .where(eq(conventionRevisions.conventionId, id))
      .orderBy(desc(conventionRevisions.revision)),
  ]);

  return { convention, sessions, revisions };
}

export async function getMembers() {
  return (await getCatalogDb())
    .select()
    .from(adminMembers)
    .orderBy(asc(adminMembers.role), asc(adminMembers.email));
}

export async function getInvites() {
  return (await getCatalogDb())
    .select()
    .from(adminInvites)
    .orderBy(desc(adminInvites.createdAt));
}

export async function getRecentActivity() {
  return (await getCatalogDb())
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
}

export function buildPublicSnapshot(input: {
  convention: Convention;
  sessions: ScheduleEvent[];
  revision: number;
}) {
  return toPublicConvention({
    convention: input.convention,
    revision: input.revision,
    sessions: input.sessions,
  });
}
