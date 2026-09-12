CREATE TABLE `workspace_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`max_call_minutes` integer DEFAULT 5 NOT NULL,
	`calling_hours_start` text DEFAULT '10:00' NOT NULL,
	`calling_hours_end` text DEFAULT '18:00' NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`max_attempts` integer DEFAULT 2 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `max_call_minutes` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `calling_hours_start` text DEFAULT '10:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `calling_hours_end` text DEFAULT '18:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `timezone` text DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `max_attempts` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `clarifications_allowed` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `last_draft_model` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `last_draft_prompt_version` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `source` text DEFAULT 'manual' NOT NULL;