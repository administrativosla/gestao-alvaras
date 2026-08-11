# Auditoria de Autorização tRPC — V3.35

**Escopo auditado:** todos os arquivos em `server/routers/*.ts`.

## Resultado executivo

A auditoria identificou procedimentos operacionais e de leitura de negócio que ainda usavam `publicProcedure`. Todos eles foram elevados ao menos para `protectedProcedure`, exceto `importacao.getCampos`, que retorna somente o catálogo estático de campos de mapeamento, sem dados de clientes, alvarás, arquivos ou configuração operacional.

Também foi adicionado o middleware `requirePermissao(modulo, acao)` no núcleo tRPC. Ele consulta a tabela `permissoes` pelo perfil do usuário ativo e bloqueia a ação com `TRPCError` de código `FORBIDDEN` quando a permissão não está concedida.

## Inventário final por router

| Router | Procedure | Nível final | Observação |
|---|---|---:|---|
| `alertas` | `listarEmails` | `protectedProcedure` | Dados de destinatários por cliente. |
| `alertas` | `adicionarEmail` | `masterProcedure` | Configuração sensível de destinatários. |
| `alertas` | `removerEmail` | `masterProcedure` | Configuração sensível de destinatários. |
| `alertas` | `listarEmailsGlobais` | `protectedProcedure` | Dados de destinatários globais. |
| `alertas` | `adicionarEmailGlobal` | `masterProcedure` | Configuração global. |
| `alertas` | `removerEmailGlobal` | `masterProcedure` | Configuração global. |
| `alertas` | `toggleEmailGlobal` | `masterProcedure` | Configuração global. |
| `alertas` | `testarEmail` | `masterProcedure` | Pode disparar e-mail. |
| `alertas` | `dispararAlertas` | `masterProcedure` | Disparo manual de alertas. |
| `alertas` | `dispararRelatorio` | `masterProcedure` | Disparo de relatório. |
| `alertas` | `exportarRelatorioAVencer` | `gestorProcedure` | Exportação operacional. |
| `alertas` | `enviarEmailConsolidadoAVencer` | `gestorProcedure` | Disparo consolidado. |
| `alertas` | `statusAlertas` | `protectedProcedure` | Status operacional dos alertas. |
| `alvaras` | `list` | `protectedProcedure` | Lista dados de alvarás e clientes. |
| `alvaras` | `get` | `protectedProcedure` | Detalhe e histórico do alvará. |
| `alvaras` | `create` | `protectedProcedure` | Criação de alvará. |
| `alvaras` | `update` | `protectedProcedure` | Atualização de alvará. |
| `alvaras` | `updateStatus` | `protectedProcedure` | Atualização de status. |
| `alvaras` | `delete` | `gestorProcedure` + `requirePermissao("alvaras", "excluir_alvara")` | Exclusão exige nível gestor e permissão da matriz. |
| `alvaras` | `getHistorico` | `protectedProcedure` | Histórico de negócio. |
| `alvaras` | `listCliParciais` | `protectedProcedure` | Pendências de CLIs. |
| `alvaras` | `resolverPendenciaOrgao` | `protectedProcedure` | Altera resolução de pendência. |
| `alvaras` | `revalidar` | `protectedProcedure` + `requirePermissao("alvaras", "revalidar_rfb")` | Revalidação depende da matriz. |
| `alvaras` | `desfazerResolucaoOrgao` | `protectedProcedure` | Altera resolução de pendência. |
| `alvaras` | `listPdfs` | `protectedProcedure` | Lista versões de documentos anexos. |
| `alvaras` | `addPdf` | `protectedProcedure` + `requirePermissao("alvaras", "importar_pdf")` | Inclusão de PDF depende da matriz. |
| `clientes` | `list` | `protectedProcedure` | Lista de clientes. |
| `clientes` | `listComCobertura` | `protectedProcedure` | Cobertura documental de clientes. |
| `clientes` | `listarEstados` | `protectedProcedure` | Localidades cadastradas. |
| `clientes` | `listarMunicipios` | `protectedProcedure` | Localidades cadastradas. |
| `clientes` | `importarPlanilha` | `gestorProcedure` | Importação de base de clientes. |
| `clientes` | `get` | `protectedProcedure` | Detalhe do cliente. |
| `clientes` | `getByCnpj` | `protectedProcedure` | Consulta de cliente por CNPJ. |
| `clientes` | `create` | `protectedProcedure` | Criação de cliente. |
| `clientes` | `update` | `protectedProcedure` | Atualização de cliente. |
| `clientes` | `delete` | `gestorProcedure` | Exclusão de cliente. |
| `clientes` | `reenriquecer` | `gestorProcedure` + `requirePermissao("clientes", "atualizar_receita")` | Consulta/atualização RFB depende da matriz. |
| `clientes` | `listSemRegistro` | `gestorProcedure` | Carteira comercial sem registro. |
| `clientes` | `exportarSemRegistroXlsx` | `gestorProcedure` | Exportação comercial. |
| `clientes` | `enviarEmailComercialSemRegistro` | `gestorProcedure` | Disparo de comunicação comercial. |
| `clientes` | `toggleSemRegistro` | `gestorProcedure` + `requirePermissao("clientes", "marcar_sem_registro")` | Marcação depende da matriz. |
| `dashboard` | `resumo` | `protectedProcedure` | Métricas de negócio. |
| `dashboard` | `alertas` | `protectedProcedure` | Fila operacional de vencimentos. |
| `dashboard` | `proximosVencimentos` | `protectedProcedure` | Dados de vencimento. |
| `dashboard` | `graficos` | `protectedProcedure` | Dados analíticos de negócio. |
| `exportacao` | `alvaras` | `gestorProcedure` | Exportação de alvarás. |
| `exportacao` | `historico` | `gestorProcedure` | Exportação de histórico. |
| `importacao` | `getCampos` | `publicProcedure` | Catálogo estático de campos de arquivo; não consulta nem expõe dados de negócio. |
| `importacao` | `parseFile` | `protectedProcedure` | Processa arquivo enviado. |
| `importacao` | `confirmarImportacao` | `protectedProcedure` | Persiste importação tabular. |
| `importacao` | `parsePdf` | `protectedProcedure` + `requirePermissao("alvaras", "importar_pdf")` | Extração individual de PDF. |
| `importacao` | `confirmarPdf` | `protectedProcedure` + `requirePermissao("alvaras", "importar_pdf")` | Confirma PDF individual. |
| `importacao` | `parsePdfLote` | `protectedProcedure` + `requirePermissao("alvaras", "importar_pdf")` | Extração de PDFs em lote. |
| `importacao` | `parseZip` | `protectedProcedure` + `requirePermissao("alvaras", "importar_pdf")` | Leitura de ZIP com PDFs. |
| `importacao` | `confirmarLote` | `protectedProcedure` + `requirePermissao("alvaras", "importar_pdf")` | Confirmação de lote. |
| `negociacoes` | `get` | `protectedProcedure` | Detalhe de negociação. |
| `negociacoes` | `listarHistorico` | `protectedProcedure` | Histórico comercial. |
| `negociacoes` | `list` | `protectedProcedure` | Lista de negociações. |
| `negociacoes` | `resumoPorStatus` | `protectedProcedure` | Indicadores comerciais. |
| `negociacoes` | `criar` | `protectedProcedure` | Criação de negociação. |
| `negociacoes` | `avancarStatus` | `protectedProcedure` | Avanço de etapa comercial. |
| `negociacoes` | `encerrar` | `gestorProcedure` | Encerramento de negociação. |
| `usuarios` | `listar` | `masterProcedure` | Dados de usuários. |
| `usuarios` | `aprovar` | `masterProcedure` | Aprovação de acesso. |
| `usuarios` | `alterarRole` | `masterProcedure` | Alteração de perfil. |
| `usuarios` | `alterarStatus` | `masterProcedure` | Bloqueio/desbloqueio. |
| `usuarios` | `meuPerfil` | `protectedProcedure` | Dados do usuário autenticado. |
| `usuarios` | `contarPendentes` | `masterProcedure` | Gestão de acessos pendentes. |
| `usuarios` | `convidar` | `masterProcedure` | Convite de usuário. |
| `usuarios` | `listarConvites` | `masterProcedure` | Gestão de convites. |
| `usuarios` | `cancelarConvite` | `masterProcedure` | Gestão de convites. |
| `admin` | `statusVarredura` | `masterProcedure` | Diagnóstico de manutenção. |
| `admin` | `reprocessarPdfs` | `masterProcedure` | Reprocessamento de PDFs. |
| `admin` | `revalidarTodos` | `masterProcedure` | Revalidação massiva. |
| `permissoes` | `listar` | `gestorProcedure` | Leitura da matriz de permissões. |
| `permissoes` | `atualizar` | `masterProcedure` | Altera permissões de perfis. |
| `permissoes` | `atualizarOperador` | `gestorProcedure` | Gestor ajusta permissões do Operador. |
| `permissoes` | `minhasPermissoes` | `protectedProcedure` | Matriz efetiva do usuário autenticado. |

## Procedures que permaneceram públicas

| Procedure | Justificativa |
|---|---|
| `importacao.getCampos` | Retorna somente o array estático `CAMPOS_MAPEAMENTO`, usado para orientar o mapeamento de colunas. Não acessa banco de dados, documentos, clientes, alvarás, CNPJs, e-mails ou qualquer dado de negócio. |

## Validação executada

| Verificação | Resultado |
|---|---|
| `pnpm check` | Concluído sem erros de tipo. |
| `pnpm test -- --run` | 5 arquivos de teste aprovados; 40 testes aprovados. |
| Novo teste de autorização | Confirma que `alvaras.revalidar` retorna `FORBIDDEN` antes do handler quando o perfil não possui `alvaras.revalidar_rfb`. |
