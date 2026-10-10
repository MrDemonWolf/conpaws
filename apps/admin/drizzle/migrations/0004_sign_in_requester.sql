-- Send limits are counted per requesting network as well as per address, so
-- someone elsewhere cannot use up a member's allowance and lock them out. The
-- network is stored only as a keyed hash, never as an IP address.
ALTER TABLE `admin_sign_in_codes` ADD `requester` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `admin_sign_in_codes_requester_idx` ON `admin_sign_in_codes` (`email`, `requester`, `created_at`);
