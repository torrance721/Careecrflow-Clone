CREATE TABLE `skill_analysis_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(64) NOT NULL,
	`jobDescriptionHash` varchar(64) NOT NULL,
	`resumeId` int NOT NULL,
	`userId` int NOT NULL,
	`jobTitle` varchar(256),
	`company` varchar(256),
	`jobUrl` varchar(512),
	`score` int NOT NULL,
	`strongMatch` json NOT NULL,
	`partialMatch` json NOT NULL,
	`missing` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `skill_analysis_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `skill_analysis_cache_cacheKey_unique` UNIQUE(`cacheKey`)
);
