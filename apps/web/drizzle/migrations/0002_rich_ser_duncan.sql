DROP INDEX `waitlist_ip_recent_idx`;--> statement-breakpoint
ALTER TABLE `waitlist` ADD `ip_bucket` text;--> statement-breakpoint
UPDATE `waitlist` SET `ip_bucket` = `ip` WHERE `ip` IS NOT NULL AND instr(`ip`, ':') = 0;--> statement-breakpoint
CREATE INDEX `waitlist_ip_bucket_recent_idx` ON `waitlist` (`ip_bucket`,`created_at`);
