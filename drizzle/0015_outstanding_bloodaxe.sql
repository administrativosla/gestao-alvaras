CREATE TABLE `permissoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`perfil` enum('operator','gestor','master') NOT NULL,
	`modulo` varchar(64) NOT NULL,
	`acao` varchar(128) NOT NULL,
	`permitido` boolean NOT NULL DEFAULT false,
	`fixo` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permissoes_id` PRIMARY KEY(`id`)
);
