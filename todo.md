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
