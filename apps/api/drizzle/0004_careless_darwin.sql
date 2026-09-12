CREATE TABLE `provider_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`type` text NOT NULL,
	`call_id` text,
	`payload` text NOT NULL,
	`received_at` integer NOT NULL,
	`processed_at` integer,
	`error` text
);
--> statement-breakpoint
ALTER TABLE `calls` ADD `provider_recipient_id` text;--> statement-breakpoint
ALTER TABLE `calls` ADD `provider_attempt_id` text;--> statement-breakpoint
ALTER TABLE `calls` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `calls` ADD `scheduled_at` integer;--> statement-breakpoint
ALTER TABLE `calls` ADD `last_polled_at` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `max_calls` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `outreach_started_at` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `outreach_paused_at` integer;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `outreach_stopped_at` integer;