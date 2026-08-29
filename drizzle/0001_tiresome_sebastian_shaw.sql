CREATE TABLE `submission_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`school_name` text NOT NULL,
	`program_name` text NOT NULL,
	`performer_total` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
