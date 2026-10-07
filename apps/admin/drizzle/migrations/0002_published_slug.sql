ALTER TABLE `conventions` ADD `published_slug` text;
--> statement-breakpoint
UPDATE `conventions`
SET `published_slug` = (
  SELECT json_extract(`snapshot_json`, '$.slug')
  FROM `convention_revisions`
  WHERE `convention_id` = `conventions`.`id`
    AND `revision` = `conventions`.`published_revision`
)
WHERE `status` = 'published'
  AND `published_revision` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `conventions` AS newer
    JOIN `convention_revisions` AS newer_revision
      ON newer_revision.`convention_id` = newer.`id`
     AND newer_revision.`revision` = newer.`published_revision`
    WHERE newer.`status` = 'published'
      AND json_extract(newer_revision.`snapshot_json`, '$.slug') = (
        SELECT json_extract(`snapshot_json`, '$.slug')
        FROM `convention_revisions`
        WHERE `convention_id` = `conventions`.`id`
          AND `revision` = `conventions`.`published_revision`
      )
      AND (newer.`updated_at` > `conventions`.`updated_at`
        OR (newer.`updated_at` = `conventions`.`updated_at`
          AND newer.`id` > `conventions`.`id`))
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `conventions_published_slug_unique`
ON `conventions` (`published_slug`)
WHERE `published_slug` IS NOT NULL;
