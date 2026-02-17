import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const conventions = sqliteTable("conventions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  icalUrl: text("ical_url"),
  status: text("status", { enum: ["upcoming", "active", "ended"] })
    .notNull()
    .default("upcoming"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  syncedAt: text("synced_at"),
});

export const conventionEvents = sqliteTable("convention_events", {
  id: text("id").primaryKey(),
  conventionId: text("convention_id")
    .notNull()
    .references(() => conventions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  location: text("location"),
  room: text("room"),
  category: text("category"),
  type: text("type", { enum: ["imported", "custom"] })
    .notNull()
    .default("custom"),
  isShareable: integer("is_shareable", { mode: "boolean" })
    .notNull()
    .default(true),
  isAgeRestricted: integer("is_age_restricted", { mode: "boolean" })
    .notNull()
    .default(false),
  contentWarning: text("content_warning"),
  sourceUid: text("source_uid"),
  sourceUrl: text("source_url"),
  isInSchedule: integer("is_in_schedule", { mode: "boolean" })
    .notNull()
    .default(false),
  reminderMinutes: integer("reminder_minutes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const offlineQueue = sqliteTable("offline_queue", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  payload: text("payload"),
  createdAt: text("created_at").notNull(),
});
