CREATE TABLE `emails_globais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`descricao` varchar(255),
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emails_globais_id` PRIMARY KEY(`id`),
	CONSTRAINT `emails_globais_email_unique` UNIQUE(`email`)
);
