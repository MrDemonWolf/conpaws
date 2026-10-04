CREATE TABLE `admin_members` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL CHECK (`role` IN ('owner', 'editor')),
	`status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active', 'disabled')),
	`created_at` integer NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE TABLE `conventions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`acronym` text DEFAULT '' NOT NULL,
	`city` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`country` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`timezone` text NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`official_url` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL CHECK (`status` IN ('draft', 'published', 'archived')),
	`published_revision` integer,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conventions_slug_unique` ON `conventions` (`slug`);
--> statement-breakpoint
CREATE INDEX `conventions_status_start_idx` ON `conventions` (`status`,`starts_on`);
--> statement-breakpoint
CREATE TABLE `schedule_events` (
	`id` text PRIMARY KEY NOT NULL,
	`convention_id` text NOT NULL REFERENCES `conventions`(`id`) ON DELETE cascade,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`room` text DEFAULT '' NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL CHECK (`status` IN ('scheduled', 'cancelled')),
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `schedule_events_convention_time_idx` ON `schedule_events` (`convention_id`,`starts_at`);
--> statement-breakpoint
CREATE TABLE `convention_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`convention_id` text NOT NULL REFERENCES `conventions`(`id`) ON DELETE restrict,
	`revision` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`summary` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `convention_revisions_number_unique` ON `convention_revisions` (`convention_id`,`revision`);
--> statement-breakpoint
CREATE INDEX `convention_revisions_recent_idx` ON `convention_revisions` (`convention_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `convention_revisions_no_update`
BEFORE UPDATE ON `convention_revisions`
BEGIN
	SELECT RAISE(ABORT, 'convention revisions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `convention_revisions_no_delete`
BEFORE DELETE ON `convention_revisions`
BEGIN
	SELECT RAISE(ABORT, 'convention revisions are immutable');
END;
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_recent_idx` ON `audit_log` (`created_at`);
--> statement-breakpoint
CREATE TRIGGER `audit_log_no_update`
BEFORE UPDATE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'audit entries are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_no_delete`
BEFORE DELETE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'audit entries are immutable');
END;
