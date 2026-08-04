ALTER TABLE `alvaras` ADD `validacaoEndereco` varchar(20);--> statement-breakpoint
ALTER TABLE `alvaras` ADD `validacaoCnae` varchar(20);--> statement-breakpoint
ALTER TABLE `alvaras` ADD `validacaoSituacao` varchar(20);--> statement-breakpoint
ALTER TABLE `alvaras` ADD `validacaoDetalhes` text;--> statement-breakpoint
ALTER TABLE `alvaras` ADD `validacaoExecutadaEm` timestamp;--> statement-breakpoint
ALTER TABLE `clientes` ADD `situacaoCadastral` varchar(30);--> statement-breakpoint
ALTER TABLE `clientes` ADD `cnaePrincipal` varchar(10);--> statement-breakpoint
ALTER TABLE `clientes` ADD `cnaePrincipalDescricao` varchar(255);--> statement-breakpoint
ALTER TABLE `clientes` ADD `cnaesSecundarios` text;--> statement-breakpoint
ALTER TABLE `clientes` ADD `porte` varchar(30);--> statement-breakpoint
ALTER TABLE `clientes` ADD `naturezaJuridica` varchar(100);--> statement-breakpoint
ALTER TABLE `clientes` ADD `capitalSocial` varchar(30);--> statement-breakpoint
ALTER TABLE `clientes` ADD `dadosReceitaAtualizadoEm` timestamp;--> statement-breakpoint
ALTER TABLE `clientes` ADD `dadosReceitaStatus` varchar(20) DEFAULT 'pendente';