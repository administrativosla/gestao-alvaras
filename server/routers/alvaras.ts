import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import {
  addHistorico,
  createAlvara,
  deleteAlvara,
  getAlvaraById,
  getDb,
  getHistoricoByAlvara,
  listAlvaras,
  updateAlvara,
} from "../db";
import { STATUS_RENOVACAO, emailsAlerta, emailsGlobais } from "../../drizzle/schema";
import { parseDate } from "../utils/parseDate";
import { enviarNotificacaoStatusAtualizado } from "../services/email";

const statusEnum = z.enum(STATUS_RENOVACAO);

const alvaraSchema = z.object({
  clienteId: z.number(),
  numeroAlvara: z.string().max(100).optional().nullable(),
  tipo: z.string().min(1).max(50),
  orgaoEmissor: z.string().max(255).optional().nullable(),
  dataEmissao: z.string().optional().nullable(),
  dataVencimento: z.string().min(1),
  arquivoPdfKey: z.string().max(500).optional().nullable(),
  arquivoPdfUrl: z.string().max(500).optional().nullable(),
});

export const alvarasRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          clienteId: z.number().optional(),
          status: z.string().optional(),
          tipo: z.string().optional(),
          diasVencimento: z.number().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listAlvaras(input);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const row = await getAlvaraById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const historico = await getHistoricoByAlvara(input.id);
      return { ...row, historico };
    }),

  create: publicProcedure.input(alvaraSchema).mutation(async ({ input, ctx }) => {
    const { dataEmissao, dataVencimento, ...rest } = input;
    const parsedVenc = parseDate(dataVencimento) ?? new Date(dataVencimento);
    // Determina status inicial: "Em Vigência" se vencer em mais de 30 dias, "Vencido" caso contrário
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(parsedVenc);
    venc.setHours(0, 0, 0, 0);
    const diasParaVencimento = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const statusInicial: string = diasParaVencimento > 30 ? "Em Vigência" : "Vencido";
    const id = await createAlvara({
      ...rest,
      dataEmissao: parseDate(dataEmissao) ?? null,
      dataVencimento: parsedVenc,
      status: statusInicial,
    });
    await addHistorico({
      alvaraId: id,
      statusAnterior: null,
      statusNovo: statusInicial,
      observacao: statusInicial === "Em Vigência"
        ? `Alvará cadastrado. Em vigência até ${parsedVenc.toLocaleDateString("pt-BR")}.`
        : "Alvará cadastrado. Vencimento próximo — atenção necessária.",
      colaborador: (ctx as any).user?.name ?? "Sistema",
    });
    return { id };
  }),

  update: publicProcedure
    .input(z.object({ id: z.number(), data: alvaraSchema.partial() }))
    .mutation(async ({ input }) => {
      const { dataEmissao, dataVencimento, ...rest } = input.data;
      await updateAlvara(input.id, {
        ...rest,
        dataEmissao: dataEmissao !== undefined ? (parseDate(dataEmissao) ?? undefined) : undefined,
        dataVencimento: dataVencimento !== undefined ? (parseDate(dataVencimento) ?? undefined) : undefined,
      });
      return { success: true };
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.number(),
        status: statusEnum,
        observacao: z.string().optional(),
        colaborador: z.string().optional(),
        novaDataVencimento: z.string().optional(), // obrigatório quando status = "Renovado"
      })
    )
    .mutation(async ({ input, ctx }) => {
      const row = await getAlvaraById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      // Ao marcar como Renovado, exige nova data de vencimento
      if (input.status === "Renovado" && !input.novaDataVencimento) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe a nova data de vencimento para concluir a renovação.",
        });
      }

      const statusAnterior = row.alvara.status;
      const responsavel = input.colaborador ?? (ctx as any).user?.name ?? "Colaborador";

      // Monta o objeto de atualização
      const updateData: Parameters<typeof updateAlvara>[1] = { status: input.status };
      if (input.status === "Renovado" && input.novaDataVencimento) {
        const novaData = parseDate(input.novaDataVencimento);
        if (!novaData) throw new TRPCError({ code: "BAD_REQUEST", message: "Data de vencimento inválida." });
        updateData.dataVencimento = novaData;
      }

      await updateAlvara(input.id, updateData);
      await addHistorico({
        alvaraId: input.id,
        statusAnterior,
        statusNovo: input.status,
        observacao: input.observacao ?? null,
        colaborador: responsavel,
      });

      // Disparo de e-mail fire-and-forget (não bloqueia a resposta ao usuário)
      const dataVencimentoFinal = updateData.dataVencimento ?? new Date(row.alvara.dataVencimento);
      const clienteId = row.alvara.clienteId;
      const emailPayload = {
        razaoSocial: row.cliente.razaoSocial,
        cnpj: row.cliente.cnpj,
        tipoAlvara: row.alvara.tipo,
        numeroAlvara: row.alvara.numeroAlvara ?? null,
        statusAnterior,
        statusNovo: input.status,
        responsavel,
        observacao: input.observacao ?? null,
        dataVencimento: dataVencimentoFinal,
      };

      (async () => {
        try {
          const db = await getDb();
          if (!db) return;

          // Busca e-mails do cliente
          const emailsDoCliente = await db
            .select()
            .from(emailsAlerta)
            .where(eq(emailsAlerta.clienteId, clienteId));

          // Busca e-mails globais ativos
          const globais = await db
            .select()
            .from(emailsGlobais)
            .where(eq(emailsGlobais.ativo, true));

          const destinatarios = Array.from(
            new Set([
              ...emailsDoCliente.map((e) => e.email),
              ...globais.map((g) => g.email),
            ])
          );

          if (destinatarios.length === 0) return;

          await enviarNotificacaoStatusAtualizado(destinatarios, emailPayload);
        } catch (emailErr) {
          console.error("[updateStatus] Falha ao enviar e-mail de notificação:", emailErr);
        }
      })();

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAlvara(input.id);
      return { success: true };
    }),

  getHistorico: publicProcedure
    .input(z.object({ alvaraId: z.number() }))
    .query(async ({ input }) => {
      return getHistoricoByAlvara(input.alvaraId);
    }),
});
