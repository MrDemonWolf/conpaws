-- Staff sign in with a one-time code sent by email. These three tables are the
-- whole identity layer; admin_members still decides who may sign in and with
-- which role.
--
-- An invite lets someone who is not yet a member receive a sign-in code. The
-- first code they enter turns the invite into an active membership.
CREATE TABLE `admin_invites` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL CHECK (`role` IN ('owner', 'editor')),
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
-- One row per code sent. Only an HMAC of the code is stored, keyed by the
-- Worker's ADMIN_AUTH_SECRET and bound to the browser attempt that asked for
-- it. Rows also back the per-address send limits, so they are kept for two
-- days before cleanup.
CREATE TABLE `admin_sign_in_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE INDEX `admin_sign_in_codes_attempt_idx` ON `admin_sign_in_codes` (`attempt_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `admin_sign_in_codes_email_idx` ON `admin_sign_in_codes` (`email`, `created_at`);
--> statement-breakpoint
-- A signed-in browser. The cookie holds a random token; only its SHA-256 is
-- stored, so a copy of this table cannot be replayed as a session.
-- `verified_at` is when a code was last entered, which gates team changes.
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL REFERENCES `admin_members`(`email`) ON DELETE CASCADE,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_sessions_email_idx` ON `admin_sessions` (`email`);
--> statement-breakpoint
CREATE INDEX `admin_sessions_expiry_idx` ON `admin_sessions` (`expires_at`);
