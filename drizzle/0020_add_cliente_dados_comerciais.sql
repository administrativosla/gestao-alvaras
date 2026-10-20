CREATE TABLE `cliente_dados_comerciais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`grupo` varchar(255),
	`classificacao` varchar(64),
	`situacaoBase` varchar(32),
	`situacaoOnvio` varchar(32),
	`contatoPrimario` varchar(255),
	`emailPrimario` varchar(320),
	`contatoSecundario` varchar(255),
	`emailSecundario` varchar(320),
	`servicosUtilizados` text,
	`arquivoOrigem` varchar(255) NOT NULL,
	`linhaOrigem` int,
	`atualizadoOrigemEm` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cliente_dados_comerciais_id` PRIMARY KEY(`id`),
	CONSTRAINT `cliente_dados_comerciais_cliente_uq` UNIQUE(`clienteId`)
);
--> statement-breakpoint
CREATE INDEX `cliente_dados_comerciais_grupo_idx` ON `cliente_dados_comerciais` (`grupo`);--> statement-breakpoint
CREATE INDEX `cliente_dados_comerciais_situacao_base_idx` ON `cliente_dados_comerciais` (`situacaoBase`);