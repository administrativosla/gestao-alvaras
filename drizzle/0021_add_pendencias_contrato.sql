CREATE TABLE `pendencias_contrato` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`tipo` enum('prestacao_servico','coworking') NOT NULL,
	`status` enum('sem_contato','cliente_contatado','contato_sem_retorno','fase_ajustes','aprovacao_minuta','links_enviados','assinado_parcial','assinado_total') NOT NULL DEFAULT 'sem_contato',
	`descricaoOrigem` varchar(500),
	`arquivoOrigem` varchar(255),
	`linhaOrigem` int,
	`contatadoEm` timestamp,
	`retornoAte` timestamp,
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pendencias_contrato_id` PRIMARY KEY(`id`),
	CONSTRAINT `pendencias_contrato_cliente_tipo_uq` UNIQUE(`clienteId`,`tipo`)
);
--> statement-breakpoint
CREATE TABLE `pendencias_contrato_excecoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documento` varchar(18) NOT NULL,
	`nomeClienteOrigem` varchar(255) NOT NULL,
	`descricaoOrigem` varchar(500),
	`tipoSugerido` enum('prestacao_servico','coworking') NOT NULL,
	`statusSugerido` enum('sem_contato','cliente_contatado','contato_sem_retorno','fase_ajustes','aprovacao_minuta','links_enviados','assinado_parcial','assinado_total') NOT NULL DEFAULT 'sem_contato',
	`statusOrigem` varchar(500),
	`motivo` varchar(500) NOT NULL,
	`situacao` enum('pendente','excluida','vinculada') NOT NULL DEFAULT 'pendente',
	`clienteId` int,
	`justificativaResolucao` text,
	`arquivoOrigem` varchar(255) NOT NULL,
	`linhaOrigem` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pendencias_contrato_excecoes_id` PRIMARY KEY(`id`),
	CONSTRAINT `pendencias_contrato_excecoes_origem_linha_uq` UNIQUE(`arquivoOrigem`,`linhaOrigem`)
);
--> statement-breakpoint
CREATE TABLE `pendencias_contrato_historico` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pendenciaId` int NOT NULL,
	`clienteId` int NOT NULL,
	`statusAnterior` varchar(32),
	`statusNovo` varchar(32) NOT NULL,
	`tipoEvento` enum('importacao','manual','automatico') NOT NULL,
	`justificativa` text,
	`usuarioId` int,
	`usuarioNome` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pendencias_contrato_historico_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pendencias_contrato_status_idx` ON `pendencias_contrato` (`status`);--> statement-breakpoint
CREATE INDEX `pendencias_contrato_retorno_idx` ON `pendencias_contrato` (`retornoAte`);--> statement-breakpoint
CREATE INDEX `pendencias_contrato_excecoes_situacao_idx` ON `pendencias_contrato_excecoes` (`situacao`);--> statement-breakpoint
CREATE INDEX `pendencias_contrato_excecoes_documento_idx` ON `pendencias_contrato_excecoes` (`documento`);--> statement-breakpoint
CREATE INDEX `pendencias_contrato_historico_pendencia_idx` ON `pendencias_contrato_historico` (`pendenciaId`);--> statement-breakpoint
CREATE INDEX `pendencias_contrato_historico_cliente_idx` ON `pendencias_contrato_historico` (`clienteId`);