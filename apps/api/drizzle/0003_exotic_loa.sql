CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`contact_id` text,
	`question_id` text NOT NULL,
	`question_text` text NOT NULL,
	`status` text NOT NULL,
	`value` text,
	`value_number` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `answers_campaign` ON `answers` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `answers_call` ON `answers` (`call_id`);--> statement-breakpoint
CREATE INDEX `answers_question` ON `answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `call_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`position` integer NOT NULL,
	`speaker` text NOT NULL,
	`text` text NOT NULL,
	`offset_seconds` integer,
	FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `call_turns_call_position` ON `call_turns` (`call_id`,`position`);--> statement-breakpoint
CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`contact_id` text,
	`person_name` text,
	`provider` text NOT NULL,
	`provider_call_id` text,
	`attempt` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`task` text NOT NULL,
	`result_schema` text NOT NULL,
	`question_map` text NOT NULL,
	`summary` text,
	`structured_result` text,
	`requests_for_organizer` text,
	`callback_requested` integer DEFAULT false NOT NULL,
	`callback_time` text,
	`opt_out` integer DEFAULT false NOT NULL,
	`failure_code` text,
	`failure_message` text,
	`started_at` integer,
	`ended_at` integer,
	`duration_seconds` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `calls_campaign` ON `calls` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `calls_contact` ON `calls` (`contact_id`);