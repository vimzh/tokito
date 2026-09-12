CREATE TABLE `contact_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`file_name` text NOT NULL,
	`headers` text NOT NULL,
	`rows` text NOT NULL,
	`mapping` text,
	`committed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`import_id` text,
	`name` text,
	`phone_raw` text NOT NULL,
	`phone` text,
	`status` text NOT NULL,
	`problem` text,
	`context` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `contact_imports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contacts_campaign` ON `contacts` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `contacts_phone` ON `contacts` (`phone`);--> statement-breakpoint
CREATE TABLE `opt_outs` (
	`phone` text PRIMARY KEY NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `default_country` text DEFAULT 'IN' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspace_settings` ADD `default_country` text DEFAULT 'IN' NOT NULL;