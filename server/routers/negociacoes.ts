import { z } from "zod";
import { router, protectedProcedure, gestorProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { negociacoes, negociacoesHistorico, alvaras, clientes, NEGOCIACAO_STATUS } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Fluxo de transições permitidas
// contato_realizado → proposta_aprovada | proposta_recusada
// proposta_aprovada → em_andamento | proposta_recusada
// em_andamento → em_vigencia | proposta_recusada
// proposta_recusada → contato_realizado (reabertura)
// em_vigencia → (terminal — requer alvará cadastrado)

const TRANSICOES_PERMITIDAS: Record<string, string[]> = {
  contato_realizado: ["proposta_aprovada", "proposta_recusada"],
  proposta_aprovada: ["em_andamento", "proposta_recusada"],
  em_andamento: ["em_vigencia", "proposta_recusada"],
  proposta_recusada: ["contato_realizado"],
  em_vigencia: [],
};

export const negociacoesRouter = router({
  // Retorna a negociação ativa de um cliente (ou null)
  get: protectedProcedure
    .input(z.object({ clienteId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [neg] = await db
        .select()
        .from(negociacoes)
        .where(and(eq(negociacoes.clienteId, input.clienteId), eq(negociacoes.ativa, true)))
        .orderBy(desc(negociacoes.createdAt))
        .limit(1);
      return neg ?? null;
    }),

  // Retorna histórico de movimentações de um cliente (todas as negociações)
  listarHistorico: protectedProcedure
    .input(z.object({ clienteId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const historico = await db
        .select()
        .from(negociacoesHistorico)
        .where(eq(negociacoesHistorico.clienteId, input.clienteId))
        .orderBy(desc(negociacoesHistorico.createdAt));

      return historico;
    }),

  // Lista todas as negociações ativas com dados do cliente (para o pipeline comercial)
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(NEGOCIACAO_STATUS).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const offset = (input.page - 1) * input.pageSize;

      const rows = await db
        .select({
          negociacao: negociacoes,
          cliente: {
            id: clientes.id,
            razaoSocial: clientes.razaoSocial,
            cnpj: clientes.cnpj,
            municipio: clientes.municipio,
            estado: clientes.estado,
          },
        })
        .from(negociacoes)
        .innerJoin(clientes, eq(negociacoes.clienteId, clientes.id))
        .where(
          and(
            eq(negociacoes.ativa, true),
            input.status ? eq(negociacoes.status, input.status) : undefined
          )
        )
        .orderBy(desc(negociacoes.updatedAt))
        .limit(input.pageSize)
        .offset(offset);

      return rows;
    }),

  // Resumo por status (para cards do pipeline)
  resumoPorStatus: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {} as Record<string, number>;

    const rows = await db
      .select({ status: negociacoes.status })
      .from(negociacoes)
      .where(eq(negociacoes.ativa, true));

    const contagem: Record<string, number> = {
      contato_realizado: 0,
      proposta_recusada: 0,
      proposta_aprovada: 0,
      em_andamento: 0,
      em_vigencia: 0,
    };

    for (const row of rows) {
      contagem[row.status] = (contagem[row.status] ?? 0) + 1;
    }

    return contagem;
  }),

  // Cria nova negociação para um cliente
  criar: protectedProcedure
    .input(
      z.object({
        clienteId: z.number(),
        responsavel: z.string().optional(),
        observacao: z.string().optional(),
        dataContato: z.string().optional(), // ISO date string
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      // Verificar se já existe negociação ativa
      const [existente] = await db
        .select({ id: negociacoes.id })
        .from(negociacoes)
        .where(and(eq(negociacoes.clienteId, input.clienteId), eq(negociacoes.ativa, true)))
        .limit(1);

      if (existente) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe uma negociação ativa para este cliente.",
        });
      }

      const responsavel = input.responsavel ?? ctx.user.name ?? ctx.user.email ?? "Sistema";

      const [result] = await db.insert(negociacoes).values({
        clienteId: input.clienteId,
        status: "contato_realizado",
        responsavel,
        observacao: input.observacao,
        dataContato: input.dataContato ? new Date(input.dataContato) : new Date(),
      });

      const negociacaoId = (result as { insertId: number }).insertId;

      // Registrar no histórico
      await db.insert(negociacoesHistorico).values({
        negociacaoId,
        clienteId: input.clienteId,
        statusAnterior: null,
        statusNovo: "contato_realizado",
        responsavel,
        observacao: input.observacao ?? "Negociação iniciada",
      });

      return { id: negociacaoId };
    }),

  // Avança ou retrocede o status da negociação
  avancarStatus: protectedProcedure
    .input(
      z.object({
        negociacaoId: z.number(),
        novoStatus: z.enum(NEGOCIACAO_STATUS),
        responsavel: z.string().optional(),
        observacao: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [neg] = await db
        .select()
        .from(negociacoes)
        .where(eq(negociacoes.id, input.negociacaoId))
        .limit(1);

      if (!neg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Negociação não encontrada." });
      }

      const permitidos = TRANSICOES_PERMITIDAS[neg.status] ?? [];
      if (!permitidos.includes(input.novoStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Transição de "${neg.status}" para "${input.novoStatus}" não é permitida.`,
        });
      }

      // Validação especial: para avançar para "em_vigencia", o cliente deve ter pelo menos 1 alvará cadastrado
      if (input.novoStatus === "em_vigencia") {
        const [alvara] = await db
          .select({ id: alvaras.id })
          .from(alvaras)
          .where(and(eq(alvaras.clienteId, neg.clienteId), eq(alvaras.ativo, true)))
          .limit(1);

        if (!alvara) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Para marcar como Em Vigência, é obrigatório cadastrar pelo menos um CLI ou alvará para este cliente primeiro.",
          });
        }
      }

      const responsavel = input.responsavel ?? ctx.user.name ?? ctx.user.email ?? "Sistema";

      // Atualizar status
      await db
        .update(negociacoes)
        .set({ status: input.novoStatus, responsavel, observacao: input.observacao })
        .where(eq(negociacoes.id, input.negociacaoId));

      // Registrar no histórico
      await db.insert(negociacoesHistorico).values({
        negociacaoId: input.negociacaoId,
        clienteId: neg.clienteId,
        statusAnterior: neg.status,
        statusNovo: input.novoStatus,
        responsavel,
        observacao: input.observacao,
      });

      return { ok: true };
    }),

  // Encerra (desativa) uma negociação
  encerrar: gestorProcedure
    .input(
      z.object({
        negociacaoId: z.number(),
        observacao: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [neg] = await db
        .select()
        .from(negociacoes)
        .where(eq(negociacoes.id, input.negociacaoId))
        .limit(1);

      if (!neg) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Negociação não encontrada." });
      }

      const responsavel = ctx.user.name ?? ctx.user.email ?? "Sistema";

      await db
        .update(negociacoes)
        .set({ ativa: false })
        .where(eq(negociacoes.id, input.negociacaoId));

      await db.insert(negociacoesHistorico).values({
        negociacaoId: input.negociacaoId,
        clienteId: neg.clienteId,
        statusAnterior: neg.status,
        statusNovo: "encerrado",
        responsavel,
        observacao: input.observacao ?? "Negociação encerrada manualmente",
      });

      return { ok: true };
    }),
});
