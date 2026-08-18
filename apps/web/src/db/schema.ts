import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Waitlist signups.
 *
 * This row IS the consent record. Under GDPR Art. 7(1) and CASL what has to be
 * producible on demand is evidence of what the person was shown and agreed to —
 * a boolean flag proves nothing. Hence `consent_copy`, `ip`, `user_agent`, and
 * `created_at` living alongside the address.
 *
 * There is deliberately no `confirm_token` column. Brevo's double-opt-in
 * endpoint owns token generation, expiry, and the confirmation click; D1
 * records the outcome, not the mechanism.
 *
 * Every column that appears in a WHERE clause is indexed — D1 bills scanned
 * rows, not returned rows.
 */
export const waitlist = sqliteTable(
  "waitlist",
  {
    id: text("id").primaryKey(),

    /** Always stored lowercased and trimmed. Uniqueness is enforced by index. */
    email: text("email").notNull(),
    name: text("name").notNull().default(""),

    /** `pending` until Brevo reports the double opt-in was confirmed. */
    status: text("status", {
      enum: ["pending", "confirmed", "unsubscribed"],
    })
      .notNull()
      .default("pending"),

    /** Where the signup came from: `web`, `seedprod-import`, … */
    source: text("source").notNull().default("web"),

    /** The exact wording shown next to the submit button at signup time. */
    consentCopy: text("consent_copy").notNull(),

    ip: text("ip"),
    userAgent: text("user_agent"),
    country: text("country"),
    referer: text("referer"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),

    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),

    /** NULL means Brevo has not accepted this contact yet. The cron replays these. */
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),

    /** Last sync failure, kept so a stuck row can be diagnosed without logs. */
    syncError: text("sync_error"),
    syncAttempts: integer("sync_attempts").notNull().default(0),
  },
  (table) => [
    uniqueIndex("waitlist_email_unique").on(table.email),
    index("waitlist_synced_at_idx").on(table.syncedAt),
    index("waitlist_status_idx").on(table.status),
  ],
);

export type WaitlistRow = typeof waitlist.$inferSelect;
export type WaitlistInsert = typeof waitlist.$inferInsert;
