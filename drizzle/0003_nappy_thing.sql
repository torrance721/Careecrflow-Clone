CREATE TABLE `interview_knowledge_bases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company` varchar(256) NOT NULL,
	`position` varchar(256) NOT NULL,
	`companyNormalized` varchar(256) NOT NULL,
	`positionNormalized` varchar(256) NOT NULL,
	`interviewProcess` json,
	`companyInfo` json,
	`tips` json,
	`sourceCount` int DEFAULT 0,
	`questionCount` int DEFAULT 0,
	`lastSearchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `interview_knowledge_bases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`knowledgeBaseId` int NOT NULL,
	`type` enum('technical','behavioral','case') NOT NULL,
	`question` text NOT NULL,
	`category` varchar(128),
	`difficulty` enum('Easy','Medium','Hard'),
	`frequency` int DEFAULT 1,
	`sampleAnswer` text,
	`source` varchar(128) NOT NULL,
	`sourceUrl` varchar(512),
	`reportedDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interview_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_base_search_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`company` varchar(256) NOT NULL,
	`position` varchar(256) NOT NULL,
	`knowledgeBaseId` int,
	`cacheHit` int DEFAULT 0,
	`searchDuration` int,
	`sourcesSearched` json,
	`resultsCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_base_search_logs_id` PRIMARY KEY(`id`)
);
