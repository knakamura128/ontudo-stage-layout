CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`school_name` text NOT NULL,
	`program_name` text NOT NULL,
	`performer_total` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	`submitted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_owner_email_unique` ON `submissions` (`owner_email`);