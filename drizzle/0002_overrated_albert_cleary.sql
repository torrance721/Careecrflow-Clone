ALTER TABLE `job_recommendations` ADD `companyId` varchar(64);--> statement-breakpoint
ALTER TABLE `job_recommendations` ADD `companyLogo` varchar(512);--> statement-breakpoint
ALTER TABLE `job_recommendations` ADD `workType` varchar(64);--> statement-breakpoint
ALTER TABLE `job_recommendations` ADD `experienceLevel` varchar(64);--> statement-breakpoint
ALTER TABLE `job_recommendations` ADD `linkedinJobId` varchar(64);--> statement-breakpoint
ALTER TABLE `job_recommendations` ADD `applyUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `job_recommendations` ADD `source` enum('manual','linkedin','ai_generated') DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `job_recommendations` ADD `scrapedAt` timestamp;