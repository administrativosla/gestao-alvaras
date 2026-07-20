import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  date,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Usuários (auth) ──────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["operator", "gestor", "master"]).default("operator").notNull(),
  userStatus: mysqlEnum("userStatus", ["pending", "active", "blocked"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Helpers de tipo para uso no frontend/backend
export type UserRole = "operator" | "gestor" | "master";
export type UserStatus = "pending" | "active" | "blocked";
export const ROLE_LABELS: Record<UserRole, string> = {
  operator: "Operador",
  gestor: "Gestor",
  master: "Master",
};
export const ROLE_LEVEL: Record<UserRole, number> = {
  operator: 1,
  gestor: 2,
  master: 3,
};

// ─── Convites de Usuário ─────────────────────────────────────────────────────
export const convites = mysqlTable("convites", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["operator", "gestor", "master"]).default("operator").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "cancelled"]).default("pending").notNull(),
  convidadoPorId: int("convidadoPorId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Convite = typeof convites.$inferSelect;
export type InsertConvite = typeof convites.$inferInsert;

// ─── Clientes ─────────────────────────────────────────────────────────────────
export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  cnpj: varchar("cnpj", { length: 18 }).notNull().unique(),
  razaoSocial: varchar("razaoSocial", { length: 255 }).notNull(),
  nomeFantasia: varchar("nomeFantasia", { length: 255 }),
  inscricaoEstadual: varchar("inscricaoEstadual", { length: 50 }),
  inscricaoMunicipal: varchar("inscricaoMunicipal", { length: 50 }),
  // Endereço
  logradouro: varchar("logradouro", { length: 255 }),
  numero: varchar("numero", { length: 20 }),
  complemento: varchar("complemento", { length: 100 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 9 }),
  // Localidade (campos dedicados para filtros — independentes do endereço completo)
  municipio: varchar("municipio", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  // Contato
  nomeContato: varchar("nomeContato", { length: 255 }),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  // Dados
  dataAbertura: date("dataAbertura"),
  observacoesPreventivas: text("observacoesPreventivas"),
  // Status comercial manual: marcado pelo gestor quando não há registro de CLI/alvará disponível para oferta
  semRegistro: boolean("semRegistro").default(false).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

// ─── E-mails de Alerta por Cliente ───────────────────────────────────────────
export const emailsAlerta = mysqlTable("emails_alerta", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailAlerta = typeof emailsAlerta.$inferSelect;
export type InsertEmailAlerta = typeof emailsAlerta.$inferInsert;

// ─── Tipos de Alvará ──────────────────────────────────────────────────────────
export const TIPOS_ALVARA = [
  "CLI",
  "Funcionamento",
  "Sanitário",
  "Bombeiros",
  "Ambiental",
  "Publicidade",
  "Obras",
  "Outros",
] as const;

/** Tipos que são documentos compostos (multi-órgão) */
export const TIPOS_COMPOSTOS = ["CLI"] as const;

export type TipoAlvara = (typeof TIPOS_ALVARA)[number];

// ─── Status de Renovação ──────────────────────────────────────────────────────
export const STATUS_RENOVACAO = [
  "Em Vigência",
  "Iniciar Renovação",
  "Vencido",
  "Contato Realizado",
  "Tratativa Comercial",
  "Documentação Solicitada",
  "Em Renovação",
  "Renovado",
  "Cancelado",
] as const;

/** Status que cessam os alertas de vencimento */
export const STATUS_SEM_ALERTA: readonly string[] = ["Em Renovação", "Renovado", "Cancelado", "Em Vigência"] as const;

export type StatusRenovacao = (typeof STATUS_RENOVACAO)[number];

// ─── Alvarás ──────────────────────────────────────────────────────────────────
export const alvaras = mysqlTable("alvaras", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  numeroAlvara: varchar("numeroAlvara", { length: 100 }),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  orgaoEmissor: varchar("orgaoEmissor", { length: 255 }),
  dataEmissao: date("dataEmissao"),
  dataVencimento: date("dataVencimento").notNull(),
  status: varchar("status", { length: 50 }).default("Vencido").notNull(),
  arquivoPdfKey: varchar("arquivoPdfKey", { length: 500 }),
  arquivoPdfUrl: varchar("arquivoPdfUrl", { length: 500 }),
  ativo: boolean("ativo").default(true).notNull(),
  // ── Campos específicos do CLI (SP) ──────────────────────────────────────────
  // Bloco "Dados da Solicitação" da capa do CLI
  cliProtocolo: varchar("cliProtocolo", { length: 50 }),         // ex.: SPM2430532320
  cliNumeroSolicitacao: varchar("cliNumeroSolicitacao", { length: 50 }), // ex.: 3728974
  cliDataSolicitacao: date("cliDataSolicitacao"),
  // Bloco "Dados da Empresa" do CLI
  cliInscricaoMunicipal: varchar("cliInscricaoMunicipal", { length: 50 }),
  cliNaturezaJuridica: varchar("cliNaturezaJuridica", { length: 100 }),
  cliFormaAtuacao: varchar("cliFormaAtuacao", { length: 255 }),
  cliAreaEstabelecimento: varchar("cliAreaEstabelecimento", { length: 30 }),
  cliCnaesLicenciados: text("cliCnaesLicenciados"),              // JSON: string[]
  // Componentes por órgão (JSON): [{orgao, tipoManifestacao, numeroDocumento, dataEmissao, dataValidade, cnaes, restricoes}]
  cliComponentes: text("cliComponentes"),
  // ── Situação do CLI (Completo / Parcial / Não Avaliado) ──────────────────────
  // null = não é CLI; "completo" = CLI finalizado; "parcial" = pendente de regularização; "nao_avaliado" = importado sem classificação
  situacaoCli: varchar("situacaoCli", { length: 20 }),
  pendenciaRegularizacao: boolean("pendenciaRegularizacao").default(false).notNull(),
  motivoPendenciaCli: text("motivoPendenciaCli"),
  // Pendências por órgão integrado (JSON): [{orgao, tipoManifestacao, status: "pendente"|"resolvido", resolvidoEm, resolvidoPor, observacao}]
  cliOrgaosPendentes: text("cliOrgaosPendentes"),
  // Controle de alertas enviados
  alertaEnviado30: boolean("alertaEnviado30").default(false).notNull(),
  alertaEnviado15: boolean("alertaEnviado15").default(false).notNull(),
  alertaEnviado7: boolean("alertaEnviado7").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alvara = typeof alvaras.$inferSelect;
export type InsertAlvara = typeof alvaras.$inferInsert;

// ─── Histórico de Movimentações ───────────────────────────────────────────────
export const alvaraHistorico = mysqlTable("alvara_historico", {
  id: int("id").autoincrement().primaryKey(),
  alvaraId: int("alvaraId").notNull(),
  statusAnterior: varchar("statusAnterior", { length: 50 }),
  statusNovo: varchar("statusNovo", { length: 50 }).notNull(),
  observacao: text("observacao"),
  colaborador: varchar("colaborador", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlvaraHistorico = typeof alvaraHistorico.$inferSelect;
export type InsertAlvaraHistorico = typeof alvaraHistorico.$inferInsert;

// ─── E-mails Globais (recebem alertas de todos os clientes) ─────────────────
export const emailsGlobais = mysqlTable("emails_globais", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  descricao: varchar("descricao", { length: 255 }),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailGlobal = typeof emailsGlobais.$inferSelect;
export type InsertEmailGlobal = typeof emailsGlobais.$inferInsert;

// ─── Negociações Comerciais ─────────────────────────────────────────────────────
// Pipeline de negociação para clientes sem registro de alvará
export const NEGOCIACAO_STATUS = [
  "contato_realizado",
  "proposta_recusada",
  "proposta_aprovada",
  "em_andamento",
  "em_vigencia",
] as const;

export type NegociacaoStatus = (typeof NEGOCIACAO_STATUS)[number];

export const NEGOCIACAO_STATUS_LABELS: Record<NegociacaoStatus, string> = {
  contato_realizado: "Contato Realizado",
  proposta_recusada: "Proposta Recusada",
  proposta_aprovada: "Proposta Aprovada",
  em_andamento: "Em Andamento",
  em_vigencia: "Em Vigência",
};

export const negociacoes = mysqlTable("negociacoes", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  status: mysqlEnum("status", [
    "contato_realizado",
    "proposta_recusada",
    "proposta_aprovada",
    "em_andamento",
    "em_vigencia",
  ]).default("contato_realizado").notNull(),
  responsavel: varchar("responsavel", { length: 255 }),
  observacao: text("observacao"),
  dataContato: date("dataContato"),
  ativa: boolean("ativa").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Negociacao = typeof negociacoes.$inferSelect;
export type InsertNegociacao = typeof negociacoes.$inferInsert;

export const negociacoesHistorico = mysqlTable("negociacoes_historico", {
  id: int("id").autoincrement().primaryKey(),
  negociacaoId: int("negociacaoId").notNull(),
  clienteId: int("clienteId").notNull(),
  statusAnterior: varchar("statusAnterior", { length: 30 }),
  statusNovo: varchar("statusNovo", { length: 30 }).notNull(),
  responsavel: varchar("responsavel", { length: 255 }),
  observacao: text("observacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NegociacaoHistorico = typeof negociacoesHistorico.$inferSelect;
export type InsertNegociacaoHistorico = typeof negociacoesHistorico.$inferInsert;

// ─── Log de Importações ─────────────────────────────────────────────────────────
export const importacoes = mysqlTable("importacoes", {
  id: int("id").autoincrement().primaryKey(),
  nomeArquivo: varchar("nomeArquivo", { length: 255 }).notNull(),
  tipoArquivo: varchar("tipoArquivo", { length: 10 }).notNull(),
  totalRegistros: int("totalRegistros").default(0),
  registrosImportados: int("registrosImportados").default(0),
  registrosErro: int("registrosErro").default(0),
  status: varchar("status", { length: 20 }).default("pendente").notNull(),
  erros: text("erros"),
  realizadoPor: varchar("realizadoPor", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Importacao = typeof importacoes.$inferSelect;
export type InsertImportacao = typeof importacoes.$inferInsert;
