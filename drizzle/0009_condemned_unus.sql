CREATE TABLE `negociacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`status` enum('contato_realizado','proposta_recusada','proposta_aprovada','em_andamento','em_vigencia') NOT NULL DEFAULT 'contato_realizado',
	`responsavel` varchar(255),
	`observacao` text,
	`dataContato` date,
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `negociacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `negociacoes_historico` (
	`id` int AUTO_INCREMENT NOT NULL,
	`negociacaoId` int NOT NULL,
	`clienteId` int NOT NULL,
	`statusAnterior` varchar(30),
	`statusNovo` varchar(30) NOT NULL,
	`responsavel` varchar(255),
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `negociacoes_historico_id` PRIMARY KEY(`id`)
);
