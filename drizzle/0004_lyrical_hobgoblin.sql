CREATE TABLE `convites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('operator','gestor','master') NOT NULL DEFAULT 'operator',
	`token` varchar(64) NOT NULL,
	`status` enum('pending','accepted','cancelled') NOT NULL DEFAULT 'pending',
	`convidadoPorId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `convites_id` PRIMARY KEY(`id`),
	CONSTRAINT `convites_token_unique` UNIQUE(`token`)
);
