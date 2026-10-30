-- Setup stays completed even if every member is later removed.
CREATE TABLE `admin_setup` (
  `id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
  `completed_at` integer NOT NULL
);
--> statement-breakpoint
-- Existing and disabled memberships, including historical accepted invites,
-- belong to an initialized console and must not enable anonymous setup.
INSERT INTO `admin_setup` (`id`, `completed_at`)
SELECT 1, unixepoch() * 1000
WHERE EXISTS (SELECT 1 FROM `admin_members`)
   OR EXISTS (SELECT 1 FROM `audit_log` WHERE `action` = 'admin.invite-accepted');
--> statement-breakpoint
-- Memberships created by invites, local development or operator recovery also
-- complete setup; the marker survives deletion of those memberships.
CREATE TRIGGER `admin_member_completes_setup`
AFTER INSERT ON `admin_members`
BEGIN
  INSERT OR IGNORE INTO `admin_setup` (`id`, `completed_at`)
  VALUES (1, NEW.created_at);
END;
