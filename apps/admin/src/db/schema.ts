import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const adminMembers = sqliteTable("admin_members", {
  email: text("email").primaryKey(),
  role: text("role", { enum: ["owner", "editor"] }).notNull(),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at").notNull(),
  createdBy: text("created_by"),
});

/** Lets someone who is not yet a member receive a sign-in code. */
export const adminInvites = sqliteTable("admin_invites", {
  email: text("email").primaryKey(),
  role: text("role", { enum: ["owner", "editor"] }).notNull(),
  invitedBy: text("invited_by").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

/** One row per emailed code; only an HMAC of the code is stored. */
export const adminSignInCodes = sqliteTable(
  "admin_sign_in_codes",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
  },
  (table) => [
    index("admin_sign_in_codes_attempt_idx").on(
      table.attemptId,
      table.createdAt,
    ),
    index("admin_sign_in_codes_email_idx").on(table.email, table.createdAt),
  ],
);

/** A signed-in browser, keyed by the SHA-256 of its cookie token. */
export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    email: text("email")
      .notNull()
      .references(() => adminMembers.email, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    verifiedAt: integer("verified_at").notNull(),
  },
  (table) => [
    index("admin_sessions_email_idx").on(table.email),
    index("admin_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const conventions = sqliteTable(
  "conventions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    acronym: text("acronym").notNull().default(""),
    city: text("city").notNull(),
    region: text("region").notNull().default(""),
    country: text("country").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    timezone: text("timezone").notNull(),
    venue: text("venue").notNull().default(""),
    officialUrl: text("official_url").notNull(),
    availability: text("availability", {
      enum: ["unknown", "not-open", "open", "waitlist", "sold-out", "closed"],
    })
      .notNull()
      .default("unknown"),
    scheduleStatus: text("schedule_status", {
      enum: ["not-released", "partial", "complete"],
    })
      .notNull()
      .default("not-released"),
    sourceVerifiedAt: text("source_verified_at"),
    status: text("status", {
      enum: ["draft", "published", "archived"],
    })
      .notNull()
      .default("draft"),
    publishedRevision: integer("published_revision"),
    publishedSlug: text("published_slug"),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("conventions_slug_unique").on(table.slug),
    uniqueIndex("conventions_published_slug_unique")
      .on(table.publishedSlug)
      .where(sql`${table.publishedSlug} IS NOT NULL`),
    index("conventions_status_start_idx").on(table.status, table.startsOn),
  ],
);

export const scheduleEvents = sqliteTable(
  "schedule_events",
  {
    id: text("id").primaryKey(),
    conventionId: text("convention_id")
      .notNull()
      .references(() => conventions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    room: text("room").notNull().default(""),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    status: text("status", { enum: ["scheduled", "cancelled"] })
      .notNull()
      .default("scheduled"),
    updatedBy: text("updated_by").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("schedule_events_convention_time_idx").on(
      table.conventionId,
      table.startsAt,
    ),
  ],
);

export const conventionRevisions = sqliteTable(
  "convention_revisions",
  {
    id: text("id").primaryKey(),
    conventionId: text("convention_id")
      .notNull()
      .references(() => conventions.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceVerifiedAt: text("source_verified_at").notNull(),
    summary: text("summary").notNull(),
    actorEmail: text("actor_email").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("convention_revisions_number_unique").on(
      table.conventionId,
      table.revision,
    ),
    index("convention_revisions_recent_idx").on(
      table.conventionId,
      table.createdAt,
    ),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    summary: text("summary").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("audit_log_recent_idx").on(table.createdAt)],
);

export const catalogSchema = {
  adminInvites,
  adminMembers,
  adminSessions,
  adminSignInCodes,
  auditLog,
  conventionRevisions,
  conventions,
  scheduleEvents,
};

export type AdminMember = typeof adminMembers.$inferSelect;
export type AdminInvite = typeof adminInvites.$inferSelect;
export type Convention = typeof conventions.$inferSelect;
export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type ConventionRevision = typeof conventionRevisions.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
