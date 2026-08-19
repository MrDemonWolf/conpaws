CREATE TABLE `waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`consent_copy` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`country` text,
	`referer` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`confirmed_at` integer,
	`synced_at` integer,
	`sync_error` text,
	`sync_attempts` integer DEFAULT 0 NOT NULL,
	`sync_attempted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_email_unique` ON `waitlist` (`email`);--> statement-breakpoint
CREATE INDEX `waitlist_status_idx` ON `waitlist` (`status`);--> statement-breakpoint
CREATE INDEX `waitlist_retry_idx` ON `waitlist` (`status`,`synced_at`,`sync_attempts`,`created_at`);