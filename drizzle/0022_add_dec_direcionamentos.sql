CREATE TABLE `dec_direcionamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(120) NOT NULL,
	`descricao` varchar(500),
	`tipoBase` enum('redirecionada_ativo','arquivada_sem_acao','arquivada_inativo','encaminhada_time_interno','redirecionada_varias') NOT NULL,
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dec_direcionamentos_id` PRIMARY KEY(`id`),
	CONSTRAINT `dec_direcionamentos_nome_unique` UNIQUE(`nome`)
);
--> statement-breakpoint
ALTER TABLE `dec_destinacoes` ADD `direcionamentoId` int;--> statement-breakpoint
ALTER TABLE `dec_destinacoes` ADD `direcionamentoNome` varchar(120);--> statement-breakpoint
CREATE INDEX `dec_direcionamentos_tipo_base_idx` ON `dec_direcionamentos` (`tipoBase`);--> statement-breakpoint
CREATE INDEX `dec_destinacoes_direcionamento_idx` ON `dec_destinacoes` (`direcionamentoId`);--> statement-breakpoint
INSERT INTO `dec_direcionamentos` (`nome`, `descricao`, `tipoBase`, `ativa`) VALUES
  ('Direcionada/enviada a cliente ativo', 'Mensagem encaminhada para um cliente ativo específico.', 'redirecionada_ativo', true),
  ('Várias empresas (envio em grupo)', 'Envio em grupo sem vínculo individual com cliente.', 'redirecionada_varias', true),
  ('Encaminhada ao time interno', 'Encaminhamento interno para setor ou responsável.', 'encaminhada_time_interno', true),
  ('Arquivada sem encaminhamento', 'Mensagem encerrada sem necessidade de encaminhamento.', 'arquivada_sem_acao', true),
  ('Arquivada — cliente inativo', 'Mensagem arquivada por se referir a cliente inativo.', 'arquivada_inativo', true)
ON DUPLICATE KEY UPDATE `descricao` = VALUES(`descricao`), `tipoBase` = VALUES(`tipoBase`);--> statement-breakpoint
UPDATE `dec_destinacoes` AS destino
INNER JOIN `dec_direcionamentos` AS direcionamento ON direcionamento.`tipoBase` = destino.`tipo`
SET destino.`direcionamentoId` = direcionamento.`id`, destino.`direcionamentoNome` = direcionamento.`nome`
WHERE destino.`direcionamentoId` IS NULL;
