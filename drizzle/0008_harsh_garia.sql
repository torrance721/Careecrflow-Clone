CREATE TABLE `ai_toolbox_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('email','cover_letter','elevator_pitch','linkedin_headline','linkedin_about') NOT NULL,
	`inputParams` json,
	`generatedContent` text NOT NULL,
	`trackedJobId` int,
	`isFavorite` int DEFAULT 0,
	`isUsed` int DEFAULT 0,
	`rating` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_toolbox_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tracked_jobs` MODIFY COLUMN `status` enum('saved','applied','interviewing','offer','rejected','archived') NOT NULL DEFAULT 'saved';--> statement-breakpoint
ALTER TABLE `tracked_jobs` MODIFY COLUMN `contactName` varchar(256);--> statement-breakpoint
ALTER TABLE `tracked_jobs` MODIFY COLUMN `contactEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `tracked_jobs` MODIFY COLUMN `contactPhone` varchar(64);--> statement-breakpoint
ALTER TABLE `tracked_jobs` MODIFY COLUMN `source` enum('manual','extension','import') DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `tracked_jobs` ADD `jobTitle` varchar(256) NOT NULL;--> statement-breakpoint
ALTER TABLE `tracked_jobs` ADD `companyName` varchar(256) NOT NULL;--> statement-breakpoint
ALTER TABLE `tracked_jobs` ADD `salary` varchar(128);--> statement-breakpoint
ALTER TABLE `tracked_jobs` ADD `description` text;--> statement-breakpoint
ALTER TABLE `tracked_jobs` ADD `columnOrder` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tracked_jobs` ADD `skillMatch` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tracked_jobs` ADD `extractedSkills` json;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `company`;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `position`;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `salaryMin`;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `salaryMax`;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `salaryCurrency`;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `applicationMethod`;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `interviewType`;--> statement-breakpoint
ALTER TABLE `tracked_jobs` DROP COLUMN `resumeId`;