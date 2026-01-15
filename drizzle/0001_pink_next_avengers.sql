CREATE TABLE `assessment_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`matchScore` int NOT NULL,
	`strengths` json,
	`improvements` json,
	`suggestions` json,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mock_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`questionIndex` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mock_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mock_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int NOT NULL,
	`status` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`matchScore` int,
	`totalQuestions` int DEFAULT 6,
	`currentQuestion` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mock_sessions_id` PRIMARY KEY(`id`)
);
