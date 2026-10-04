ALTER TABLE `conventions`
ADD COLUMN `availability` text DEFAULT 'unknown' NOT NULL
CHECK (`availability` IN ('unknown', 'not-open', 'open', 'waitlist', 'sold-out', 'closed'));
--> statement-breakpoint
ALTER TABLE `conventions`
ADD COLUMN `schedule_status` text DEFAULT 'not-released' NOT NULL
CHECK (`schedule_status` IN ('not-released', 'partial', 'complete'));
--> statement-breakpoint
ALTER TABLE `conventions` ADD COLUMN `source_verified_at` text;
--> statement-breakpoint
ALTER TABLE `convention_revisions`
ADD COLUMN `source_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `convention_revisions`
ADD COLUMN `source_verified_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `convention_revisions`
SET `source_url` = COALESCE(
      (SELECT `official_url` FROM `conventions` WHERE `conventions`.`id` = `convention_revisions`.`convention_id`),
      ''
    ),
    `source_verified_at` = COALESCE(
      (SELECT `source_verified_at` FROM `conventions` WHERE `conventions`.`id` = `convention_revisions`.`convention_id`),
      ''
    );
