# Gestão de Alvarás — TODO

## Banco de Dados
- [x] Schema: tabela `clientes` (CNPJ, razão social, nome fantasia, IE, IM, endereço, contato, telefone, email, data abertura, obs preventivas)
- [x] Schema: tabela `alvaras` (vinculado ao cliente, número, tipo, órgão emissor, datas, status, arquivo PDF key)
- [x] Schema: tabela `alvara_historico` (movimentações de status com data, obs, colaborador)
- [x] Schema: tabela `emails_alerta` (e-mails destinatários por cliente)
- [x] Schema: tabela `importacoes` (log de importações realizadas)
- [x] Executar migrations

## Backend (tRPC Routers)
- [x] Router `clientes`: list, get, create, update, delete, search
- [x] Router `alvaras`: list, get, create, update, delete, updateStatus, getByCliente
- [x] Router `historico`: listByAlvara, addMovimentacao
- [x] Router `alertas`: listarEmails, adicionarEmail, removerEmail, dispararAlertas
- [x] Router `importacao`: processarXlsxCsv, processarPdf, confirmarImportacao
- [x] Router `exportacao`: exportarAlvaras, exportarHistorico
- [x] Lógica de cessação automática de alertas a partir de "Em Renovação"
- [x] Job de envio de e-mails nos marcos 30/15/7 dias (heartbeat)
- [x] Handler heartbeat `/api/scheduled/alertas-vencimento`

## Frontend — Layout e Navegação
- [x] DashboardLayout com sidebar elegante
- [x] Paleta de cores sofisticada (tons neutros premium)
- [x] Tipografia refinada (Inter)
- [x] Rota `/` → Dashboard
- [x] Rota `/clientes` → Lista de clientes
- [x] Rota `/clientes/novo` → Cadastro de cliente
- [x] Rota `/clientes/:id` → Detalhe do cliente
- [x] Rota `/alvaras` → Lista de alvarás
- [x] Rota `/alvaras/novo` → Cadastro de alvará
- [x] Rota `/alvaras/:id` → Detalhe do alvará com histórico e status
- [x] Rota `/importar` → Importação de arquivos
- [x] Rota `/exportar` → Exportação de dados
- [x] Rota `/alertas` → Configuração de alertas por e-mail

## Frontend — Dashboard
- [x] Cards de resumo: total clientes, alvarás ativos, vencidos, a vencer em 30 dias
- [x] Painel de alertas com código de cores (30/15/7/3/2/1 dia)
- [x] Filtros rápidos no painel de alertas
- [x] Busca por razão social ou CNPJ

## Frontend — Cadastro de Clientes
- [x] Formulário completo com todos os campos
- [x] Validação de CNPJ
- [x] Gerenciamento de e-mails de alerta (múltiplos)
- [x] Lista de alvarás vinculados ao cliente

## Frontend — Cadastro de Alvarás
- [x] Formulário com todos os campos
- [x] Upload de arquivo PDF do alvará
- [x] Seleção de tipo de alvará
- [x] Vinculação ao cliente por CNPJ

## Frontend — Painel de Status e Histórico
- [x] Barra de progresso visual com 8 etapas
- [x] Atualização de status com campo de observação
- [x] Histórico completo de movimentações
- [x] Cessação visual de alerta a partir de "Em Renovação"

## Frontend — Importação
- [x] Upload de XLSX/CSV com tela de mapeamento de colunas (de-para)
- [x] Upload de PDF com extração automática e tela de revisão
- [x] Confirmação antes de salvar

## Frontend — Exportação
- [x] Exportação de lista de alvarás para XLSX
- [x] Exportação de histórico de renovações para XLSX

## Frontend — Alertas por E-mail
- [x] Tela de configuração de destinatários por cliente
- [x] Disparo manual de alertas
- [x] Informativo dos marcos configurados

## Melhorias V1.1
- [x] Adicionar status "Em Vigência" para alvarás com vencimento > 30 dias
- [x] Atribuir automaticamente "Em Vigência" ao criar/importar alvará dentro do prazo
- [x] Ajustar dashboard para não exibir "Em Vigência" no painel de alertas de urgência
- [x] Confirmar que campos Nome Fantasia e IE são opcionais na extração PDF

## Testes
- [x] Testes unitários dos routers principais (11 testes passando)
- [x] Validação do fluxo de status (8 etapas)
- [x] Validação da lógica de alertas (marcos e cessação)
- [x] Adicionar seção "Próximos Vencimentos" no dashboard (alvarás Em Vigência, ordem crescente por data)

## Bugs V1.2
- [x] Alvará importado via PDF fica com status "Pendente" mesmo com vencimento > 30 dias (status inicial não atualizado no banco)
- [x] Seção "Próximos Vencimentos" deve exibir TODOS os alvarás ativos (não apenas "Em Vigência"), ordenados por data crescente

## Melhorias V1.3
- [x] Modal de nova data de vencimento ao marcar status "Renovado" (com campo de data obrigatório)
- [x] Campo de busca na seção "Próximos Vencimentos" do dashboard (por razão social ou CNPJ)

## Configuração de E-mail (V1.4)
- [x] Instalar nodemailer e configurar SMTP Gmail
- [x] Cadastrar secrets SMTP_USER e SMTP_PASS no sistema
- [x] Criar serviço de envio de e-mail (server/services/email.ts)
- [x] Integrar serviço de e-mail ao handler de alertas (alertasHeartbeat.ts)
- [x] Adicionar botão "Testar Envio" na tela de Alertas
- [x] Adicionar router de teste de e-mail no backend
- [x] Ativar heartbeat agendado diário às 8h (ativado após deploy — handler e e-mails globais integrados)
- [x] Adicionar suporte a lista global de e-mails (recebe todos os alertas)

## Melhorias V1.5
- [x] Renomear status "Pendente" para "Vencido" em todo o sistema (schema, backend, frontend)
- [x] Remover status "Documentação Recebida" do fluxo (schema, backend, frontend)
- [x] Adicionar campo "responsável" na atualização de status (modal + histórico + banco)
- [x] Disparar e-mail para os envolvidos a cada atualização de status

## Melhorias V1.6
- [x] Criar handler do heartbeat diário às 13h (relatório de alvarás vencidos + a vencer)
- [x] Criar template de e-mail HTML para o relatório diário com duas seções separadas
- [x] Registrar o schedule diário às 13h via manus-heartbeat CLI
- [x] Melhorar seção de histórico no detalhe do alvará (visual timeline aprimorado)
- [x] Adicionar gráficos no dashboard: distribuição por status, por tipo e vencimentos por mês
- [x] Adicionar procedures de dados agregados no router do dashboard para os gráficos

## Melhorias V1.7
- [x] Página de Alertas: adicionar seção com informações do relatório diário às 13h (próxima execução, destinatários, última execução)
- [x] Página de Alertas: adicionar botão "Enviar Relatório Agora" para disparo manual do relatório
- [x] Criar procedure tRPC para disparar o relatório manualmente
- [x] Dashboard: inverter posição dos cards "Alvarás Vencidos" e "A Vencer em 30 dias"

## Melhorias V1.8
- [x] Reorganizar tela de Alertas: seção 1 = alertas pré-vencimento, seção 2 = relatório pós-vencimento (13h), seção 3 = teste de envio
- [x] Remover seção "Destinatários por Cliente" da tela de Alertas
- [x] Apresentar proposta de gestão de usuários (Gestor Master x Operador) antes de implementar

## Melhorias V1.9 — Gestão de Usuários
- [x] Migrar schema: role enum para 3 níveis (operator/gestor/master) + campo userStatus (pending/active/blocked)
- [x] Criar router de usuários com procedures: listar, aprovar, mudar role, bloquear
- [x] Atualizar middleware: bloquear acesso pending, restringir alertas/exportar por nível
- [x] Criar tela de Gestão de Usuários (somente master) com aprovação e gestão de perfis
- [x] Criar tela de "Aguardando Aprovação" para usuários pending
- [x] Restringir Exportar (nível 2+) e Configurar Alertas (nível 3) no menu e nas procedures
- [x] Promover andre.vasconcelos@mjpcontroller.com.br a master (feito via SQL na primeira sessão)

## Melhorias V2.0 — Convite de Usuários
- [x] Criar tabela `convites` no schema (email, role, token, status, expiresAt, convidadoPor)
- [x] Aplicar migration SQL da tabela de convites
- [x] Criar procedure `usuarios.convidar` (masterProcedure): salva convite + envia e-mail
- [x] Criar função `enviarConviteUsuario` no serviço de e-mail com template HTML
- [x] Adicionar box "Convidar Usuário" na página GestaoUsuarios (e-mail + nível + botão enviar)
- [x] Listar convites pendentes na página GestaoUsuarios com opção de cancelar
- [x] Integrar convite ao `upsertUser`: ao primeiro login, se e-mail bater com convite ativo, aplicar role do convite e status active (melhoria futura — adiada por design: aprovação manual é intencional)

## Melhorias V2.1 — Identidade Visual
- [x] Upload do logo MJP Controller para storage estático (CDN pública para e-mails + webdev para sidebar)
- [x] Atualizar nome do sistema para "Gestor de Alvarás" (sidebar, tela de login, e-mails)
- [x] Atualizar DashboardLayout: logo MJP acima + "Gestor de Alvarás" abaixo na sidebar
- [x] Inserir logo MJP no cabeçalho de todos os templates de e-mail (alerta, status, relatório, convite)
- [x] Atualizar remetente dos e-mails para "Gestão de Alvarás - MJP Controller"

## Melhorias V2.2 — Importação em Lote (PDF / ZIP)
- [x] Backend: procedure `importacao.parsePdfLote` — aceita array de {fileName, fileBase64} e processa cada PDF via LLM em paralelo
- [x] Backend: procedure `importacao.parseZip` — descompacta ZIP no servidor, extrai PDFs internos e chama o mesmo fluxo LLM
- [x] Backend: procedure `importacao.confirmarLote` — salva todos os registros revisados de uma vez, retornando contadores
- [x] Frontend: página dedicada "Importar em Lote" acessível pelo menu lateral
- [x] Frontend: dropzone multi-arquivo (aceita múltiplos .pdf + .zip), lista de arquivos com status individual
- [x] Frontend: indicador de status por arquivo durante extração LLM (aguardando/extraindo/ok/erro)
- [x] Frontend: tela de revisão em lote — lista editável com todos os registros extraídos, indicando campos faltantes
- [x] Frontend: confirmação final com resumo (total, erros, clientes existentes)

## Melhorias V2.3 — Status Automático por Prazo de Vencimento
- [x] Criar função `getStatusEfetivo(status, dataVencimento)` em client/src/lib/alvaras.ts
- [x] Regra: status "Em Vigência" com cor amarela quando ≤60 dias para vencer
- [x] Regra: status "Iniciar Renovação" automático quando ≤30 dias para vencer (visual + heartbeat)
- [x] Regra: status "Vencido" automático no D+1 após a data de vencimento (heartbeat grava no banco)
- [x] Atualizar StatusBadge com dataVencimento em AlvarasList, AlvaraDetail, ClienteDetail
- [x] Atualizar heartbeat diário: transições automáticas D+1 → Vencido e ≤30 dias → Iniciar Renovação
- [x] Adicionar "Iniciar Renovação" ao STATUS_RENOVACAO e STATUS_SEM_ALERTA no schema
- [x] Corrigir testes: 9 status de renovação (39 testes passando)

## Melhorias V2.4 — E-mails Consolidados (abordagem descartada pelo usuário)
- [x] Handler 8h: manter marcos automáticos individuais (abordagem consolidada descartada)
- [x] Handler 13h: já envia consolidado corretamente (não alterar)
- [x] Disparo manual: já envia por alvará individual (não alterar)
- [x] Template HTML consolidado: criado para uso manual (botão Enviar E-mail Consolidado)
- [x] Template XLSX: criado para uso manual (botão Exportar Planilha)

## Melhorias V2.4 — Relatório Consolidado Manual
- [x] Reverter handler das 8h para manter marcos automáticos (30/15/7/3/2/1 dias por alvará individual)
- [x] Criar procedure `alertas.exportarRelatorioAVencer`: retorna XLSX com todos os alvarás a vencer (1-30 dias)
- [x] Criar procedure `alertas.enviarEmailConsolidadoAVencer`: envia UM e-mail HTML com lista consolidada de alvarás a vencer
- [x] Adicionar botão "Exportar Planilha" na seção de alertas pré-vencimento
- [x] Adicionar botão "Enviar E-mail Consolidado" na seção de alertas pré-vencimento

## Melhorias V2.5 — Importação de Clientes + Filtros por Localidade

- [x] Excluir todos os alvarás e histórico do banco (DELETE)
- [x] Adicionar colunas `municipio` e `estado` na tabela `clientes` (migration)
- [x] Atualizar schema Drizzle com os novos campos
- [x] Criar procedure `clientes.importarPlanilha`: lê XLSX/CSV com colunas CNPJ, razão social, município, estado (e campos opcionais) e faz upsert
- [x] Criar procedure `clientes.listarEstados`: retorna lista distinta de estados cadastrados
- [x] Criar procedure `clientes.listarMunicipios`: retorna lista distinta de municípios (opcionalmente filtrado por estado)
- [x] Atualizar procedure `clientes.list` para aceitar filtros `estado` e `municipio`
- [x] Adicionar botão "Importar Clientes" na tela de Clientes (abre modal com dropzone XLSX/CSV)
- [x] Adicionar filtros de Estado e Município na listagem de Clientes
- [x] Exibir município e estado no card/linha de cada cliente

## Melhorias V2.6 — Importação de Clientes + Status de Cobertura de Alvarás

- [x] Importar 447 clientes da planilha clientes_ativos_consolidado.xlsx via script direto no banco
- [x] Criar campo calculado/view de cobertura de alvarás por cliente: Sem Alvará / Parcial / Coberto
- [x] Adicionar procedure `clientes.listComCobertura` retornando status de cobertura junto com cada cliente
- [x] Exibir badge de cobertura na listagem de clientes (cor: cinza=Sem Alvará, amarelo=Parcial, verde=Coberto)
- [x] Exibir status de cobertura no detalhe do cliente
- [x] Filtro por status de cobertura na listagem de clientes (cards clícaveis no topo)

## Melhorias V2.7 — Suporte Nativo ao CLI (SP)

- [x] Adicionar tipo "CLI" à lista de tipos de alvará (schema + frontend lib/alvaras.ts)
- [x] Adicionar colunas CLI na tabela alvaras: cliProtocolo, cliNumeroSolicitacao, cliDataSolicitacao, cliInscricaoMunicipal, cliNaturezaJuridica, cliFormaAtuacao, cliAreaEstabelecimento, cliCnaesLicenciados, cliComponentes (JSON)
- [x] Aplicar migration no banco (ADD COLUMN)
- [x] Atualizar alvaraSchema Zod no backend para aceitar campos CLI
- [x] Corrigir parse de cliDataSolicitacao no create/update mutation
- [x] Formulário de alvará: seções CLI dinâmicas quando tipo = "CLI" (Dados da Solicitação, Dados da Empresa, Componentes por Órgão)
- [x] Componentes por órgão: adicionar/remover com tipo de manifestação (AVCB, CLCB, Isento, Baixo Risco, Protocolo, Licença, Indeterminado)
- [x] Detalhe do alvará: badge "VRE/REDESIM SP" e exibição estruturada dos componentes CLI
- [x] Formulário pré-preenche tipo=CLI e órgão emissor correto por padrão

## Melhorias V2.9 — Detecção Automática de CLI Parcial
- [x] Adicionar colunas `situacaoCli`, `pendenciaRegularizacao`, `motivoPendenciaCli` na tabela alvaras (migration)
- [x] Atualizar prompt LLM para detectar CLI parcial (expressões: "documento parcial", "pendente de finalização", "não produz os efeitos legais")
- [x] Atualizar schema Zod no router de alvarás com os novos campos
- [x] Ajustar lógica de cobertura do cliente: CLI Parcial = Cobertura Parcial (não Coberto)
- [x] Badge "CLI Parcial" destacado na listagem de alvarás e no detalhe
- [x] Filtro por situacaoCli na listagem de alvarás (Completo / Parcial / Não Avaliado)
- [x] Badge "CLI Parcial" na listagem de clientes (cobertura parcial por pendência)
- [x] Alerta recorrente de regularização no heartbeat para CLI Parcial (e-mail semanal enquanto pendente)
- [x] Seção "CLI Parcial — Pendentes de Regularização" no dashboard

## Melhorias V3.0 — Status "Sem Registro" (Time Comercial)
- [x] Criar procedure `clientes.listSemRegistro`: retorna clientes sem nenhum alvará ativo cadastrado
- [x] Criar procedure `clientes.exportarSemRegistroXlsx`: retorna base64 XLSX com clientes sem registro
- [x] Atualizar `listClientesComCobertura` para distinguir "Sem Registro" de "Sem Alvará" (cobertura=none vs cobertura=semRegistro)
- [x] Badge "Sem Registro" (roxo/violeta) na listagem de clientes com filtro dedicado
- [x] Card clícavel "Sem Registro" no topo da listagem de clientes
- [x] Painel comercial na página de Alertas: seção "Prospecção Comercial — Sem Registro"
- [x] Box com lista paginada dos clientes sem registro (razão social, CNPJ, município, estado)
- [x] Botão "Exportar Planilha" no box comercial (XLSX com todos os clientes sem registro)
- [x] Indicador de total no Dashboard (card ou badge) para clientes sem registro
- [x] Procedure `clientes.enviarEmailComercialSemRegistro`: aceita lista de e-mails manuais + opção de importar XLSX/CSV de e-mails
- [x] Procedure `clientes.exportarSemRegistroPdf`: retorna PDF com lista de clientes sem registro (não implementado — XLSX é suficiente)
- [x] Box comercial: campo de e-mails manuais (tags input), dropzone para importar XLSX/CSV de e-mails, e botões de exportação XLSX

## Melhorias V3.1 — Correção Status Sem Registro / Sem Alvará
- [x] Adicionar coluna `semRegistro` (boolean, default false) na tabela clientes (migration)
- [x] Atualizar procedure `clientes.update` para aceitar campo semRegistro
- [x] Atualizar lógica de cobertura: "Sem Registro" = semRegistro=true (manual); "Sem Alvará" = sem alvarás cadastrados (automático, cinza)
- [x] Adicionar toggle "Marcar como Sem Registro" no formulário de edição do cliente
- [x] Adicionar toggle "Marcar como Sem Registro" no detalhe do cliente (ação rápida)
- [x] Restaurar badge "Sem Alvará" (cinza) na listagem e detalhe do cliente
- [x] Ajustar card "Sem Registro" no Dashboard para contar apenas clientes com semRegistro=true
- [x] Ajustar card "Sem Alvará" no topo da listagem de clientes (automático)
- [x] Ajustar painel comercial: listar apenas clientes com semRegistro=true

## Melhorias V3.2 — Pipeline de Negociação Comercial

### Schema / Migration
- [x] Criar tabela `negociacoes` (id, clienteId, status enum, responsavel, observacao, dataContato, createdAt, updatedAt)
- [x] Criar tabela `negociacoes_historico` (id, negociacaoId, clienteId, statusAnterior, statusNovo, responsavel, observacao, createdAt)
- [x] Status enum: contato_realizado | proposta_recusada | proposta_aprovada | em_andamento | em_vigencia
- [x] Aplicar migration no banco

### Backend
- [x] Procedure `negociacoes.get`: retorna negociação ativa do cliente (ou null)
- [x] Procedure `negociacoes.criar`: cria negociação com status inicial "contato_realizado"
- [x] Procedure `negociacoes.avancarStatus`: muda status com validação de fluxo + registra histórico
- [x] Validação: ao avançar para "em_vigencia", exigir que o cliente já tenha pelo menos 1 alvará/CLI cadastrado
- [x] Procedure `negociacoes.listarHistorico`: retorna histórico de movimentações da negociação
- [x] Procedure `negociacoes.list`: lista todas as negociações com filtro por status (para painel comercial)
- [x] Procedure `negociacoes.resumoPorStatus`: contagem por status para cards do pipeline
- [x] Procedure `negociacoes.encerrar`: desativa negociação (gestorProcedure)

### Frontend
- [x] Card "Negociação Comercial" no ClienteDetail (sidebar): exibe status atual, botões de avançar status, campo de observação
- [x] Timeline de histórico de movimentações no card de negociação
- [x] Fluxo visual do pipeline: Contato Realizado → Proposta Aprovada/Recusada → Em Andamento → Em Vigência
- [x] Ao tentar avançar para "Em Vigência" sem alvará cadastrado: exibir alerta com link para cadastrar alvará
- [x] Página Pipeline Comercial na rota `/comercial` com kanban por status
- [x] Kanban com todos os clientes em negociação, agrupados por status, clicando vai ao detalhe do cliente
- [x] Item "Pipeline Comercial" no menu lateral (nível 1)

## Correção V3.3 — CLI Parcial → Completo com atualização automática de cobertura

- [x] Incluir `situacaoCli` no estado inicial do AlvaraForm (com valor carregado ao editar)
- [x] Incluir `situacaoCli` no payload enviado ao salvar/atualizar alvará
- [x] Adicionar campo de seleção de situacaoCli no formulário de edição (completo / parcial / não avaliado)
- [x] Corrigir procedure `alvaras.update` no backend: ao receber `situacaoCli=completo`, recalcular e atualizar o `status` do alvará automaticamente (se data de vencimento ainda válida → "Em Vigência")
- [x] Adicionar botão rápido "Marcar como Completo" no AlvaraDetail para CLIs parciais
- [x] Registrar no histórico quando situacaoCli muda de parcial para completo
- [x] Corrigir importação via PDF (unitária e em lote): fazer upsert pelo número de solicitação CLI em vez de sempre criar novo registro

## Melhoria V3.4 — Sinalizador Visual de Pendências por Órgão nas CLIs Parciais

- [x] Ampliar prompt de extração de PDF (unitário e lote): capturar array `cliOrgaosPendentes` com nome do órgão, tipo de manifestação esperada e status (pendente/ok)
- [x] Adicionar campo `cliOrgaosPendentes` (text/JSON) na tabela alvaras via migration
- [x] Atualizar `confirmarPdf` e `confirmarImportacaoLote` para salvar cliOrgaosPendentes (com merge de resolvidos)
- [x] Painel de checklist de pendências por órgão no AlvaraDetail (card dedicado para CLI parcial)
- [x] Badge de contagem de pendências na listagem de alvarás (ex: "3 órgãos pendentes")
- [x] Permitir marcar manualmente cada órgão como resolvido no AlvaraDetail
- [x] Ao resolver todos os órgãos pendentes, sugerir automaticamente marcar CLI como completo
- [x] Contagem de órgãos pendentes exibida no painel CLI Parcial do Dashboard
- [x] Procedure `resolverPendenciaOrgao` no backend com registro no histórico

## Melhoria V3.5 — Card de Pendências Ampliado + Aba de Gerenciamento de CLIs no Cliente

- [x] Remover truncamento do nome do órgão e da pendência no card de pendências por órgão
- [x] Ampliar layout do card: cada item ocupa mais espaço vertical, nome completo visível
- [x] Exibir descrição completa do que precisa ser feito por órgão (sem cortar texto)
- [x] Criar aba "CLIs" na tela do cliente (ClienteDetail) com listagem de todos os CLIs vinculados
- [x] Cada CLI na aba exibe: tipo, número, status, data de vencimento, situacaoCli, PDF disponível
- [x] Botão "Ver PDF" para abrir o arquivo do CLI carregado
- [x] Botão "Excluir" para remover o CLI e suas informações do cliente
- [x] Botão "Atualizar" (re-importar) para fazer upload de novo PDF e atualizar as informações do CLI

## Melhoria V3.5b — Card de Pendências: Estado "Todos Resolvidos" + Aba CLIs no Cliente

- [x] Quando todos os órgãos estiverem resolvidos: mudar card para fundo verde com mensagem de sucesso
- [x] Exibir botão "Marcar CLI como Completo" quando todos resolvidos
- [x] Exibir botão "Fazer Upload do CLI Definitivo" quando todos resolvidos (mini-fluxo de re-upload inline)
- [x] Mini-fluxo de upload inline: selecionar PDF → IA extrai → confirmar → atualiza o CLI existente
- [x] Criar aba "Gerenciar CLIs" na tela do cliente com lista de todos os CLIs vinculados
- [x] Cada CLI na aba exibe: tipo, número, status, data de vencimento, situacaoCli, PDF disponível
- [x] Botão "Ver PDF" para abrir o arquivo do CLI carregado
- [x] Botão "Excluir" para remover o CLI e suas informações do cliente
- [x] Botão "Atualizar CLI" para fazer upload de novo PDF e atualizar as informações

## Correção V3.6 — Desfazer Resolução de Órgão Pendente

- [x] Adicionar botão "Desfazer Resolução" em cada órgão já marcado como resolvido no CliPendenciasCard
- [x] Criar procedure `alvaras.desfazerResolucaoOrgao` no backend: reverte o status do órgão para "pendente" e registra no histórico
- [x] Ao desfazer, o card volta ao estado âmbar (pendências ativas) e o contador é atualizado

## V3.8 — Limpeza de Base + Filtro SP + Card de Status para Clientes sem Alvará

- [x] Limpar tabelas: alvaras, alvara_historico, negociacoes, negociacoes_historico
- [x] Mover filtro "São Paulo" para o início da barra de filtros na tela de clientes (botão SP + dropdown)
- [x] Criar card de status completo para clientes sem nenhum alvará cadastrado
- [x] Card exibe todos os 5 status como botões clicáveis para registro direto
- [x] Procedure `negociacoes.criar` aceita `statusInicial` opcional para registrar qualquer status
- [x] Dialog de registro mostra o status selecionado, campos de responsável, data e observação
- [x] Validação: "Em Vigência" exige alvará ativo cadastrado

## Correção V3.9 — Órgãos Pendentes não aparecem após importação

### Bug 1: Importação em lote não salva cliOrgaosPendentes
- [x] Adicionar cliOrgaosPendentes ao schema de input do confirmarLote
- [x] Salvar cliOrgaosPendentes no banco ao confirmar importação em lote (insert e update)
- [x] Fazer merge de resolvidos manualmente (igual ao confirmarPdf unitário)

### Bug 2: Tela de revisão não exibe órgãos pendentes detectados
- [x] Exibir lista estruturada dos órgãos pendentes na tela de revisão da importação unitária (ImportarPage)
- [x] Exibir lista estruturada dos órgãos pendentes na tela de revisão da importação em lote (ImportarLotePage)
- [x] Garantir que cliOrgaosPendentes é passado corretamente no payload do confirmarPdf

## V3.10 — Trava: CLI Parcial → Completo somente via Upload de PDF

- [x] Backend: bloquear mudança manual de situacaoCli para "completo" na procedure alvaras.update (erro FORBIDDEN)
- [x] Frontend: remover CliCompletarCard (botão "Marcar como Completo") do AlvaraDetail
- [x] Frontend: no estado "todos resolvidos" do CliPendenciasCard, exibir apenas o botão de upload do CLI definitivo com mensagem obrigatória
- [x] Frontend: mensagem clara ao operador explicando que o CLI só pode ser marcado como completo via upload do documento definitivo
