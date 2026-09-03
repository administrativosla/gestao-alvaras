CREATE TABLE `certidao_consultas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`fonte` varchar(50) NOT NULL DEFAULT 'receita_federal',
	`origem` enum('consulta_anterior','nova_emissao_assistida') NOT NULL,
	`status` enum('iniciada','aguardando_emissao','aguardando_registro','concluida','indisponivel','erro') NOT NULL DEFAULT 'iniciada',
	`resultado` enum('nao_classificado','negativa','positiva','positiva_efeito_negativa','sem_certidao_valida','indisponivel','erro') NOT NULL DEFAULT 'nao_classificado',
	`urlFonte` varchar(1000) NOT NULL,
	`mensagemCapturada` text,
	`observacoes` text,
	`operadorId` int NOT NULL,
	`operadorNome` varchar(255) NOT NULL,
	`finalizadoPorId` int,
	`finalizadoPorNome` varchar(255),
	`consultadoEm` timestamp NOT NULL DEFAULT (now()),
	`finalizadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certidao_consultas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certidao_versoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultaId` int NOT NULL,
	`clienteId` int NOT NULL,
	`versao` int NOT NULL,
	`tipo` enum('pdf','imagem','texto') NOT NULL,
	`fileName` varchar(500),
	`fileKey` varchar(500),
	`fileUrl` varchar(1000),
	`mimeType` varchar(100),
	`fileSize` int,
	`sha256` varchar(64),
	`textoCapturado` text,
	`validadeAte` date,
	`capturadoPorId` int NOT NULL,
	`capturadoPorNome` varchar(255) NOT NULL,
	`capturadoEm` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certidao_versoes_id` PRIMARY KEY(`id`),
	CONSTRAINT `certidao_versoes_consulta_versao_uq` UNIQUE(`consultaId`,`versao`)
);
--> statement-breakpoint
CREATE INDEX `certidao_consultas_cliente_idx` ON `certidao_consultas` (`clienteId`);--> statement-breakpoint
CREATE INDEX `certidao_consultas_fonte_data_idx` ON `certidao_consultas` (`fonte`,`consultadoEm`);--> statement-breakpoint
CREATE INDEX `certidao_versoes_consulta_idx` ON `certidao_versoes` (`consultaId`);--> statement-breakpoint
CREATE INDEX `certidao_versoes_cliente_idx` ON `certidao_versoes` (`clienteId`);