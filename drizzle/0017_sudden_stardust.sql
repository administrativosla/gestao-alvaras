CREATE TABLE `dec_auditoria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entidade` enum('categoria','recebimento','destinacao') NOT NULL,
	`entidadeId` int NOT NULL,
	`acao` varchar(40) NOT NULL,
	`antes` text,
	`depois` text,
	`operadorId` int NOT NULL,
	`operadorNome` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dec_auditoria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dec_categorias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(120) NOT NULL,
	`descricao` varchar(500),
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dec_categorias_id` PRIMARY KEY(`id`),
	CONSTRAINT `dec_categorias_nome_unique` UNIQUE(`nome`)
);
--> statement-breakpoint
CREATE TABLE `dec_destinacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recebimentoId` int NOT NULL,
	`tipo` enum('redirecionada_ativo','arquivada_sem_acao','arquivada_inativo') NOT NULL,
	`quantidade` int NOT NULL,
	`clienteId` int,
	`clienteNome` varchar(255),
	`observacao` varchar(1000),
	`operadorId` int NOT NULL,
	`operadorNome` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dec_destinacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dec_recebimentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoriaId` int NOT NULL,
	`dataRecebimento` date NOT NULL,
	`quantidade` int NOT NULL,
	`observacao` varchar(1000),
	`operadorId` int NOT NULL,
	`operadorNome` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dec_recebimentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `dec_auditoria_entidade_idx` ON `dec_auditoria` (`entidade`,`entidadeId`);--> statement-breakpoint
CREATE INDEX `dec_destinacoes_recebimento_idx` ON `dec_destinacoes` (`recebimentoId`);--> statement-breakpoint
CREATE INDEX `dec_destinacoes_cliente_idx` ON `dec_destinacoes` (`clienteId`);--> statement-breakpoint
CREATE INDEX `dec_recebimentos_data_categoria_idx` ON `dec_recebimentos` (`dataRecebimento`,`categoriaId`);