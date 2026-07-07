ALTER TABLE `alvaras` ADD `situacaoCli` varchar(20);--> statement-breakpoint
ALTER TABLE `alvaras` ADD `pendenciaRegularizacao` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `alvaras` ADD `motivoPendenciaCli` text;