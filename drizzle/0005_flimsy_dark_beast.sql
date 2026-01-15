CREATE TABLE `bookmarked_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topic` varchar(256) NOT NULL,
	`question` text NOT NULL,
	`difficulty` enum('easy','medium','hard') DEFAULT 'medium',
	`targetPosition` varchar(256),
	`notes` text,
	`practiceCount` int DEFAULT 0,
	`lastPracticedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookmarked_questions_id` PRIMARY KEY(`id`)
);
