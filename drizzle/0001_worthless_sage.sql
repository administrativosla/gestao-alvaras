CREATE TABLE `alvara_historico` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alvaraId` int NOT NULL,
	`statusAnterior` varchar(50),
	`statusNovo` varchar(50) NOT NULL,
	`observacao` text,
	`colaborador` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alvara_historico_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alvaras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`numeroAlvara` varchar(100),
	`tipo` varchar(50) NOT NULL,
	`orgaoEmissor` varchar(255),
	`dataEmissao` date,
	`dataVencimento` date NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'Pendente',
	`arquivoPdfKey` varchar(500),
	`arquivoPdfUrl` varchar(500),
	`ativo` boolean NOT NULL DEFAULT true,
	`alertaEnviado30` boolean NOT NULL DEFAULT false,
	`alertaEnviado15` boolean NOT NULL DEFAULT false,
	`alertaEnviado7` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alvaras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cnpj` varchar(18) NOT NULL,
	`razaoSocial` varchar(255) NOT NULL,
	`nomeFantasia` varchar(255),
	`inscricaoEstadual` varchar(50),
	`inscricaoMunicipal` varchar(50),
	`logradouro` varchar(255),
	`numero` varchar(20),
	`complemento` varchar(100),
	`bairro` varchar(100),
	`cidade` varchar(100),
	`uf` varchar(2),
	`cep` varchar(9),
	`nomeContato` varchar(255),
	`telefone` varchar(20),
	`email` varchar(320),
	`dataAbertura` date,
	`observacoesPreventivas` text,
	`ativo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`),
	CONSTRAINT `clientes_cnpj_unique` UNIQUE(`cnpj`)
);
--> statement-breakpoint
CREATE TABLE `emails_alerta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clienteId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emails_alerta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nomeArquivo` varchar(255) NOT NULL,
	`tipoArquivo` varchar(10) NOT NULL,
	`totalRegistros` int DEFAULT 0,
	`registrosImportados` int DEFAULT 0,
	`registrosErro` int DEFAULT 0,
	`status` varchar(20) NOT NULL DEFAULT 'pendente',
	`erros` text,
	`realizadoPor` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `importacoes_id` PRIMARY KEY(`id`)
);
