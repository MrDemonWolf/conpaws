import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conventions = sqliteTable("conventions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  timeZone: text("time_zone"),
  location: text("location"),
  archivedAt: text("archived_at"),
  icalUrl: text("ical_url"),
  status: text("status", { enum: ["upcoming", "active", "ended"] })
    .notNull()
    .default("upcoming"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const conventionEvents = sqliteTable("convention_events", {
  id: text("id").primaryKey(),
  conventionId: text("convention_id")
    .notNull()
    .references(() => conventions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  location: text("location"),
  room: text("room"),
  category: text("category"),
  type: text("type"),
  isInSchedule: integer("is_in_schedule", { mode: "boolean" })
    .notNull()
    .default(false),
  reminderMinutes: integer("reminder_minutes"),
  sourceUid: text("source_uid"),
  sourceUrl: text("source_url"),
  isAgeRestricted: integer("is_age_restricted", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Audience rating from the feed. Null means the feed did not say. */
  ageRating: text("age_rating", {
    enum: ["all-ages", "teen", "mature", "adult"],
  }),
  contentWarning: integer("content_warning", { mode: "boolean" })
    .notNull()
    .default(false),
  /**
   * Set only on an event the user saved that the feed stopped publishing.
   * Null is the ordinary case. `cancelled` means the feed said so; `removed`
   * means it merely stopped listing the event, which is a weaker claim and is
   * worded more cautiously on screen. Re-appearing in a later import clears it.
   */
  feedStatus: text("feed_status", { enum: ["cancelled", "removed"] }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// The `offline_queue` table that migration 1 creates has no reader or writer
// and no Drizzle declaration on purpose. Rewriting a shipped migration is the
// riskier change, so the empty table stays on disk until a future migration
// drops it.

export type Convention = typeof conventions.$inferSelect;
export type NewConvention = typeof conventions.$inferInsert;
export type ConventionEvent = typeof conventionEvents.$inferSelect;
export type NewConventionEvent = typeof conventionEvents.$inferInsert;
