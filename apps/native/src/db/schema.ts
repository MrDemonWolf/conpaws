import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const conventions = sqliteTable("conventions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  timeZone: text("time_zone"),
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
  contentWarning: integer("content_warning", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const offlineQueue = sqliteTable("offline_queue", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type Convention = typeof conventions.$inferSelect;
export type NewConvention = typeof conventions.$inferInsert;
export type ConventionEvent = typeof conventionEvents.$inferSelect;
export type NewConventionEvent = typeof conventionEvents.$inferInsert;
