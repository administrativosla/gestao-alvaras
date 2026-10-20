import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  clientes,
  PENDENCIA_CONTRATO_STATUS,
  PENDENCIA_CONTRATO_TIPOS,
  pendenciasContrato,
  pendenciasContratoExcecoes,
  pendenciasContratoHistorico,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { gestorProcedure, protectedProcedure, requirePermissao, router } from "../_core/trpc";

const statusSchema = z.enum(PENDENCIA_CONTRATO_STATUS);
const tipoSchema = z.enum(PENDENCIA_CONTRATO_TIPOS);
const ARQUIVO_ORIGEM_PADRAO = "Controle de Pendências CPS";
const dataPeriodoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data no formato AAAA-MM-DD.").refine((valor) => {
  const data = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}, "Data inválida.");

function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function texto(valor: unknown, maximo = 500): string | null {
  const valorLimpo = String(valor ?? "").replace(/\s+/g, " ").trim();
  return valorLimpo ? valorLimpo.slice(0, maximo) : null;
}

function limparDocumento(valor: unknown): string {
  const somenteDigitos = String(valor ?? "").replace(/\D/g, "");
  return somenteDigitos.padStart(14, "0");
}

function cnpjValido(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const calcularDigito = (digitos: string, pesos: number[]) => {
    const soma = digitos.split("").reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? "0" : String(11 - resto);
  };
  return calcularDigito(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === cnpj[12]
    && calcularDigito(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === cnpj[13];
}

function classificarTipo(descricao: string | null): "prestacao_servico" | "coworking" {
  const comparavel = normalizarTexto(descricao);
  return comparavel.includes("cowork") || comparavel.includes("endereco fiscal")
    ? "coworking"
    : "prestacao_servico";
}

function mapearStatusOrigem(statusOrigem: string | null): (typeof PENDENCIA_CONTRATO_STATUS)[number] {
  const comparavel = normalizarTexto(statusOrigem);
  if (!comparavel) return "sem_contato";
  if (comparavel.includes("contato sem retorno")) return "contato_sem_retorno";
  if (comparavel.includes("link enviado")) return "links_enviados";
  // Decisão do usuário: "ASSINADO" sem confirmação de todos os signatários é parcial.
  if (comparavel.includes("assinado")) return "assinado_parcial";
  if (comparavel.includes("condicionou") || comparavel.includes("aguardando revisao")) return "fase_ajustes";
  return "sem_contato";
}

function descricaoImportacao(statusOrigem: string | null): string {
  if (!statusOrigem) return "Pendência importada sem andamento informado na planilha de origem.";
  return `Pendência importada. Status informado na origem: ${statusOrigem}.`;
}

export type ResultadoTransicaoAutomatica = { processadas: number; ids: number[] };

/**
 * Processa somente pendências ainda em "Cliente contatado" cujo prazo de 48h venceu.
 * Pode ser chamado com segurança mais de uma vez porque a atualização muda o status.
 */
export async function processarContatoSemRetornoAutomatico(): Promise<ResultadoTransicaoAutomatica> {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível.");

  const agora = new Date();
  const pendenciasVencidas = await db
    .select()
    .from(pendenciasContrato)
    .where(
      and(
        eq(pendenciasContrato.ativa, true),
        eq(pendenciasContrato.status, "cliente_contatado"),
        lte(pendenciasContrato.retornoAte, agora),
      ),
    );

  const ids: number[] = [];
  for (const pendencia of pendenciasVencidas) {
    await db
      .update(pendenciasContrato)
      .set({ status: "contato_sem_retorno", retornoAte: null })
      .where(
        and(
          eq(pendenciasContrato.id, pendencia.id),
          eq(pendenciasContrato.status, "cliente_contatado"),
        ),
      );

    await db.insert(pendenciasContratoHistorico).values({
      pendenciaId: pendencia.id,
      clienteId: pendencia.clienteId,
      statusAnterior: "cliente_contatado",
      statusNovo: "contato_sem_retorno",
      tipoEvento: "automatico",
      justificativa: "Prazo de 48 horas após o contato expirado sem nova atualização.",
      usuarioNome: "Sistema",
    });
    ids.push(pendencia.id);
  }

  return { processadas: ids.length, ids };
}

const linhaImportacaoSchema = z.object({
  linhaOrigem: z.number().int().positive(),
  documento: z.string().min(1).max(18),
  nomeClienteOrigem: z.string().min(1).max(255),
  clienteId: z.number().int().positive().nullable(),
  descricaoOrigem: z.string().max(500).nullable(),
  tipo: tipoSchema,
  status: statusSchema,
  statusOrigem: z.string().max(500).nullable(),
  incluir: z.boolean().default(true),
});

export const pendenciasContratoRouter = router({
  resumo: protectedProcedure.use(requirePermissao("pendencias_contrato", "visualizar"))
    .query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, abertas: 0, vencendo48h: 0, porStatus: {}, porTipo: {}, excecoesPendentes: 0 };

      const [pendencias, excecoes] = await Promise.all([
        db.select().from(pendenciasContrato).where(eq(pendenciasContrato.ativa, true)),
        db.select({ id: pendenciasContratoExcecoes.id })
          .from(pendenciasContratoExcecoes)
          .where(eq(pendenciasContratoExcecoes.situacao, "pendente")),
      ]);
      const agora = new Date();
      const porStatus: Record<string, number> = Object.fromEntries(PENDENCIA_CONTRATO_STATUS.map((status) => [status, 0]));
      const porTipo: Record<string, number> = Object.fromEntries(PENDENCIA_CONTRATO_TIPOS.map((tipo) => [tipo, 0]));
      for (const pendencia of pendencias) {
        porStatus[pendencia.status] = (porStatus[pendencia.status] ?? 0) + 1;
        porTipo[pendencia.tipo] = (porTipo[pendencia.tipo] ?? 0) + 1;
      }
      return {
        total: pendencias.length,
        abertas: pendencias.filter((pendencia) => pendencia.status !== "assinado_total").length,
        vencendo48h: pendencias.filter((pendencia) => pendencia.status === "cliente_contatado" && pendencia.retornoAte && pendencia.retornoAte <= agora).length,
        porStatus,
        porTipo,
        excecoesPendentes: excecoes.length,
      };
    }),

  list: protectedProcedure.use(requirePermissao("pendencias_contrato", "visualizar"))
    .input(z.object({
      status: statusSchema.optional(),
      tipo: tipoSchema.optional(),
      search: z.string().max(255).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          pendencia: pendenciasContrato,
          cliente: {
            id: clientes.id,
            cnpj: clientes.cnpj,
            razaoSocial: clientes.razaoSocial,
            nomeFantasia: clientes.nomeFantasia,
            nomeContato: clientes.nomeContato,
            telefone: clientes.telefone,
            email: clientes.email,
          },
        })
        .from(pendenciasContrato)
        .innerJoin(clientes, eq(pendenciasContrato.clienteId, clientes.id))
        .where(and(eq(pendenciasContrato.ativa, true), eq(clientes.ativo, true)))
        .orderBy(asc(pendenciasContrato.retornoAte), desc(pendenciasContrato.updatedAt));

      const search = normalizarTexto(input?.search);
      return rows.filter(({ pendencia, cliente }) => {
        if (input?.status && pendencia.status !== input.status) return false;
        if (input?.tipo && pendencia.tipo !== input.tipo) return false;
        if (!search) return true;
        return normalizarTexto(cliente.razaoSocial).includes(search)
          || cliente.cnpj.replace(/\D/g, "").includes(search.replace(/\D/g, ""))
          || normalizarTexto(cliente.nomeFantasia).includes(search);
      });
    }),

  /** Dados consolidados para o relatório PDF periódico do gestor. */
  relatorio: protectedProcedure.use(requirePermissao("pendencias_contrato", "exportar_relatorio"))
    .input(z.object({
      inicio: dataPeriodoSchema,
      fim: dataPeriodoSchema,
      status: statusSchema.optional(),
      tipo: tipoSchema.optional(),
    }))
    .query(async ({ input }) => {
      if (input.inicio > input.fim) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A data inicial não pode ser posterior à data final." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      // Datas do usuário são dias de operação em São Paulo. O limite final é exclusivo.
      const inicio = new Date(`${input.inicio}T00:00:00-03:00`);
      const fimExclusivo = new Date(`${input.fim}T00:00:00-03:00`);
      fimExclusivo.setUTCDate(fimExclusivo.getUTCDate() + 1);

      const [pendencias, movimentacoes] = await Promise.all([
        db.select({
          pendencia: pendenciasContrato,
          cliente: {
            id: clientes.id,
            cnpj: clientes.cnpj,
            razaoSocial: clientes.razaoSocial,
            nomeContato: clientes.nomeContato,
          },
        })
          .from(pendenciasContrato)
          .innerJoin(clientes, eq(pendenciasContrato.clienteId, clientes.id))
          .where(and(eq(pendenciasContrato.ativa, true), eq(clientes.ativo, true)))
          .orderBy(asc(clientes.razaoSocial)),
        db.select({
          evento: pendenciasContratoHistorico,
          pendencia: {
            id: pendenciasContrato.id,
            tipo: pendenciasContrato.tipo,
            status: pendenciasContrato.status,
          },
          cliente: {
            id: clientes.id,
            cnpj: clientes.cnpj,
            razaoSocial: clientes.razaoSocial,
          },
        })
          .from(pendenciasContratoHistorico)
          .innerJoin(pendenciasContrato, eq(pendenciasContratoHistorico.pendenciaId, pendenciasContrato.id))
          .innerJoin(clientes, eq(pendenciasContratoHistorico.clienteId, clientes.id))
          .where(and(
            gte(pendenciasContratoHistorico.createdAt, inicio),
            lt(pendenciasContratoHistorico.createdAt, fimExclusivo),
          ))
          .orderBy(desc(pendenciasContratoHistorico.createdAt)),
      ]);

      const atendeFiltros = (pendencia: { status: string; tipo: string }) =>
        (!input.status || pendencia.status === input.status)
        && (!input.tipo || pendencia.tipo === input.tipo);
      const pendenciasFiltradas = pendencias.filter(({ pendencia }) => atendeFiltros(pendencia));
      const movimentacoesFiltradas = movimentacoes.filter(({ pendencia }) => atendeFiltros(pendencia));
      const porStatus: Record<string, number> = Object.fromEntries(PENDENCIA_CONTRATO_STATUS.map((status) => [status, 0]));
      const porTipo: Record<string, number> = Object.fromEntries(PENDENCIA_CONTRATO_TIPOS.map((tipo) => [tipo, 0]));
      for (const { pendencia } of pendenciasFiltradas) {
        porStatus[pendencia.status] = (porStatus[pendencia.status] ?? 0) + 1;
        porTipo[pendencia.tipo] = (porTipo[pendencia.tipo] ?? 0) + 1;
      }

      return {
        filtros: input,
        pendencias: pendenciasFiltradas,
        movimentacoes: movimentacoesFiltradas,
        resumo: {
          totalPendencias: pendenciasFiltradas.length,
          abertas: pendenciasFiltradas.filter(({ pendencia }) => pendencia.status !== "assinado_total").length,
          porStatus,
          porTipo,
          movimentacoesNoPeriodo: movimentacoesFiltradas.length,
          movimentacoesManuais: movimentacoesFiltradas.filter(({ evento }) => evento.tipoEvento === "manual").length,
          movimentacoesAutomaticas: movimentacoesFiltradas.filter(({ evento }) => evento.tipoEvento === "automatico").length,
          assinaturasTotaisNoPeriodo: movimentacoesFiltradas.filter(({ evento }) => evento.statusNovo === "assinado_total").length,
        },
      };
    }),

  get: protectedProcedure.use(requirePermissao("pendencias_contrato", "visualizar"))
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const [row] = await db
        .select({ pendencia: pendenciasContrato, cliente: clientes })
        .from(pendenciasContrato)
        .innerJoin(clientes, eq(pendenciasContrato.clienteId, clientes.id))
        .where(eq(pendenciasContrato.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Pendência não encontrada." });
      const historico = await db
        .select()
        .from(pendenciasContratoHistorico)
        .where(eq(pendenciasContratoHistorico.pendenciaId, input.id))
        .orderBy(desc(pendenciasContratoHistorico.createdAt));
      return { ...row, historico };
    }),

  atualizarStatus: protectedProcedure.use(requirePermissao("pendencias_contrato", "atualizar_status"))
    .input(z.object({
      id: z.number().int().positive(),
      status: statusSchema,
      justificativa: z.string().trim().min(3, "Informe uma justificativa com pelo menos 3 caracteres.").max(3000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const [atual] = await db.select().from(pendenciasContrato).where(eq(pendenciasContrato.id, input.id)).limit(1);
      if (!atual) throw new TRPCError({ code: "NOT_FOUND", message: "Pendência não encontrada." });
      if (atual.status === input.status) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um status diferente do atual." });

      const agora = new Date();
      const entrouEmContato = input.status === "cliente_contatado";
      const retornoAte = entrouEmContato ? new Date(agora.getTime() + 48 * 60 * 60 * 1000) : null;
      await db.update(pendenciasContrato).set({
        status: input.status,
        contatadoEm: entrouEmContato ? agora : atual.contatadoEm,
        retornoAte,
      }).where(eq(pendenciasContrato.id, atual.id));
      await db.insert(pendenciasContratoHistorico).values({
        pendenciaId: atual.id,
        clienteId: atual.clienteId,
        statusAnterior: atual.status,
        statusNovo: input.status,
        tipoEvento: "manual",
        justificativa: input.justificativa,
        usuarioId: ctx.user.id,
        usuarioNome: ctx.user.name ?? ctx.user.email ?? "Usuário",
      });
      return { ok: true, retornoAte };
    }),

  previsualizarImportacao: gestorProcedure.use(requirePermissao("pendencias_contrato", "importar"))
    .input(z.object({ fileBase64: z.string().min(1), fileName: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64.replace(/^data:[^,]+,/, ""), "base64");
      const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new TRPCError({ code: "BAD_REQUEST", message: "A planilha não possui aba para importar." });
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
      const headers = (matriz[0] ?? []).map((header) => normalizarTexto(header));
      const indice = (...nomes: string[]) => headers.findIndex((header) => nomes.some((nome) => header === normalizarTexto(nome)));
      const indiceNome = indice("Nome");
      const indiceCliente = indice("Cliente", "Razão Social", "Razao Social");
      const indiceDocumento = indice("CNPJ/CPF", "CNPJ", "CPF");
      const indiceStatus = indice("STATUS", "Status");
      if (indiceNome < 0 || indiceCliente < 0 || indiceDocumento < 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "São obrigatórias as colunas Nome, Cliente e CNPJ/CPF." });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const todosClientes = await db.select({ id: clientes.id, cnpj: clientes.cnpj, razaoSocial: clientes.razaoSocial })
        .from(clientes).where(eq(clientes.ativo, true));
      const porCnpj = new Map(todosClientes.map((cliente) => [cliente.cnpj.replace(/\D/g, ""), cliente]));

      const registros = [] as Array<z.infer<typeof linhaImportacaoSchema>>;
      const excecoes = [] as Array<z.infer<typeof linhaImportacaoSchema> & { motivo: string }>;
      const chaves = new Set<string>();
      for (let index = 1; index < matriz.length; index++) {
        const linha = matriz[index] ?? [];
        const nomeClienteOrigem = texto(linha[indiceCliente], 255);
        const descricaoOrigem = texto(linha[indiceNome], 500);
        const documento = limparDocumento(linha[indiceDocumento]);
        const statusOrigem = indiceStatus >= 0 ? texto(linha[indiceStatus], 500) : null;
        if (!nomeClienteOrigem && !descricaoOrigem && !documento) continue;
        const tipo = classificarTipo(descricaoOrigem);
        const status = mapearStatusOrigem(statusOrigem);
        const base = { linhaOrigem: index + 1, documento, nomeClienteOrigem: nomeClienteOrigem ?? "Cliente não informado", descricaoOrigem, tipo, status, statusOrigem, incluir: true } as const;
        if (!cnpjValido(documento)) {
          excecoes.push({ ...base, clienteId: null, motivo: "CNPJ inválido ou CPF não suportado para conciliação automática." });
          continue;
        }
        const cliente = porCnpj.get(documento);
        if (!cliente) {
          excecoes.push({ ...base, clienteId: null, motivo: "CNPJ não localizado na base compartilhada de clientes." });
          continue;
        }
        const chave = `${cliente.id}:${tipo}`;
        if (chaves.has(chave)) {
          excecoes.push({ ...base, clienteId: cliente.id, motivo: "Há mais de uma linha para o mesmo cliente e tipo de contrato na planilha." });
          continue;
        }
        chaves.add(chave);
        registros.push({ ...base, clienteId: cliente.id });
      }
      return { arquivoOrigem: input.fileName, aba: sheetName, registros, excecoes };
    }),

  confirmarImportacao: gestorProcedure.use(requirePermissao("pendencias_contrato", "importar"))
    .input(z.object({
      arquivoOrigem: z.string().min(1).max(255),
      registros: z.array(linhaImportacaoSchema),
      excecoes: z.array(linhaImportacaoSchema.extend({ motivo: z.string().min(1).max(500) })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      let criadas = 0;
      let existentesAtualizadas = 0;
      let excecoesRegistradas = 0;
      const detalhes: string[] = [];

      for (const registro of input.registros.filter((item) => item.incluir && item.clienteId)) {
        const [cliente] = await db.select({ id: clientes.id }).from(clientes)
          .where(and(eq(clientes.id, registro.clienteId!), eq(clientes.ativo, true))).limit(1);
        if (!cliente) {
          detalhes.push(`Linha ${registro.linhaOrigem}: cliente não encontrado ou inativo.`);
          continue;
        }
        const [existente] = await db.select().from(pendenciasContrato)
          .where(and(eq(pendenciasContrato.clienteId, cliente.id), eq(pendenciasContrato.tipo, registro.tipo))).limit(1);
        if (existente) {
          // Reimportação atualiza a referência da fonte, mas preserva o andamento e o histórico interno.
          await db.update(pendenciasContrato).set({
            descricaoOrigem: registro.descricaoOrigem,
            arquivoOrigem: input.arquivoOrigem,
            linhaOrigem: registro.linhaOrigem,
            ativa: true,
          }).where(eq(pendenciasContrato.id, existente.id));
          existentesAtualizadas++;
          continue;
        }
        const [resultado] = await db.insert(pendenciasContrato).values({
          clienteId: cliente.id,
          tipo: registro.tipo,
          status: registro.status,
          descricaoOrigem: registro.descricaoOrigem,
          arquivoOrigem: input.arquivoOrigem,
          linhaOrigem: registro.linhaOrigem,
          ativa: true,
        });
        const pendenciaId = Number(resultado.insertId);
        await db.insert(pendenciasContratoHistorico).values({
          pendenciaId,
          clienteId: cliente.id,
          statusAnterior: null,
          statusNovo: registro.status,
          tipoEvento: "importacao",
          justificativa: descricaoImportacao(registro.statusOrigem),
          usuarioId: ctx.user.id,
          usuarioNome: ctx.user.name ?? ctx.user.email ?? "Usuário",
        });
        criadas++;
      }

      for (const excecao of input.excecoes.filter((item) => item.incluir)) {
        await db.insert(pendenciasContratoExcecoes).values({
          documento: excecao.documento,
          nomeClienteOrigem: excecao.nomeClienteOrigem,
          descricaoOrigem: excecao.descricaoOrigem,
          tipoSugerido: excecao.tipo,
          statusSugerido: excecao.status,
          statusOrigem: excecao.statusOrigem,
          motivo: excecao.motivo,
          situacao: "pendente",
          arquivoOrigem: input.arquivoOrigem,
          linhaOrigem: excecao.linhaOrigem,
        }).onDuplicateKeyUpdate({
          set: {
            documento: excecao.documento,
            nomeClienteOrigem: excecao.nomeClienteOrigem,
            descricaoOrigem: excecao.descricaoOrigem,
            tipoSugerido: excecao.tipo,
            statusSugerido: excecao.status,
            statusOrigem: excecao.statusOrigem,
            motivo: excecao.motivo,
            situacao: "pendente",
          },
        });
        excecoesRegistradas++;
      }
      return { criadas, existentesAtualizadas, excecoesRegistradas, detalhes };
    }),

  listExcecoes: protectedProcedure.use(requirePermissao("pendencias_contrato", "visualizar"))
    .input(z.object({ situacao: z.enum(["pendente", "excluida", "vinculada"]).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(pendenciasContratoExcecoes)
        .where(input?.situacao ? eq(pendenciasContratoExcecoes.situacao, input.situacao) : undefined)
        .orderBy(desc(pendenciasContratoExcecoes.updatedAt));
    }),

  buscarClientesParaVinculo: gestorProcedure.use(requirePermissao("pendencias_contrato", "gerenciar_excecoes"))
    .input(z.object({ search: z.string().trim().min(2).max(255) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const consulta = normalizarTexto(input.search);
      const rows = await db.select({ id: clientes.id, cnpj: clientes.cnpj, razaoSocial: clientes.razaoSocial })
        .from(clientes).where(eq(clientes.ativo, true)).orderBy(asc(clientes.razaoSocial));
      return rows.filter((cliente) => normalizarTexto(cliente.razaoSocial).includes(consulta)
        || cliente.cnpj.replace(/\D/g, "").includes(consulta.replace(/\D/g, ""))).slice(0, 20);
    }),

  resolverExcecao: gestorProcedure.use(requirePermissao("pendencias_contrato", "gerenciar_excecoes"))
    .input(z.object({
      id: z.number().int().positive(),
      acao: z.enum(["vincular", "excluir"]),
      clienteId: z.number().int().positive().optional(),
      tipo: tipoSchema.optional(),
      status: statusSchema.optional(),
      justificativa: z.string().trim().min(3, "Informe uma justificativa.").max(3000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const [excecao] = await db.select().from(pendenciasContratoExcecoes).where(eq(pendenciasContratoExcecoes.id, input.id)).limit(1);
      if (!excecao) throw new TRPCError({ code: "NOT_FOUND", message: "Exceção não encontrada." });
      if (excecao.situacao !== "pendente") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta exceção já foi tratada." });

      if (input.acao === "excluir") {
        await db.update(pendenciasContratoExcecoes).set({ situacao: "excluida", justificativaResolucao: input.justificativa })
          .where(eq(pendenciasContratoExcecoes.id, excecao.id));
        return { ok: true, pendenciaId: null };
      }
      if (!input.clienteId || !input.tipo || !input.status) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente, tipo e status são obrigatórios para vincular." });
      }
      const [cliente] = await db.select({ id: clientes.id }).from(clientes)
        .where(and(eq(clientes.id, input.clienteId), eq(clientes.ativo, true))).limit(1);
      if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente selecionado não encontrado." });
      const [existente] = await db.select().from(pendenciasContrato)
        .where(and(eq(pendenciasContrato.clienteId, cliente.id), eq(pendenciasContrato.tipo, input.tipo))).limit(1);
      let pendenciaId: number;
      if (existente) {
        pendenciaId = existente.id;
      } else {
        const [resultado] = await db.insert(pendenciasContrato).values({
          clienteId: cliente.id,
          tipo: input.tipo,
          status: input.status,
          descricaoOrigem: excecao.descricaoOrigem,
          arquivoOrigem: excecao.arquivoOrigem,
          linhaOrigem: excecao.linhaOrigem,
          ativa: true,
        });
        pendenciaId = Number(resultado.insertId);
        await db.insert(pendenciasContratoHistorico).values({
          pendenciaId,
          clienteId: cliente.id,
          statusAnterior: null,
          statusNovo: input.status,
          tipoEvento: "manual",
          justificativa: `Exceção vinculada manualmente. ${input.justificativa}`,
          usuarioId: ctx.user.id,
          usuarioNome: ctx.user.name ?? ctx.user.email ?? "Usuário",
        });
      }
      await db.update(pendenciasContratoExcecoes).set({
        situacao: "vinculada",
        clienteId: cliente.id,
        justificativaResolucao: input.justificativa,
      }).where(eq(pendenciasContratoExcecoes.id, excecao.id));
      return { ok: true, pendenciaId };
    }),
});
