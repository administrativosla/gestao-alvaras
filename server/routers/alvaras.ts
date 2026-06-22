import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  addHistorico,
  createAlvara,
  deleteAlvara,
  getAlvaraById,
  getHistoricoByAlvara,
  listAlvaras,
  updateAlvara,
} from "../db";
import { STATUS_RENOVACAO } from "../../drizzle/schema";
import { parseDate } from "../utils/parseDate";

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
    const id = await createAlvara({
      ...rest,
      dataEmissao: parseDate(dataEmissao) ?? null,
      dataVencimento: parseDate(dataVencimento) ?? new Date(dataVencimento),
      status: "Pendente",
    });

    await addHistorico({
      alvaraId: id,
      statusAnterior: null,
      statusNovo: "Pendente",
      observacao: "Alvará cadastrado no sistema.",
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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const row = await getAlvaraById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const statusAnterior = row.alvara.status;
      await updateAlvara(input.id, { status: input.status });

      await addHistorico({
        alvaraId: input.id,
        statusAnterior,
        statusNovo: input.status,
        observacao: input.observacao ?? null,
        colaborador:
          input.colaborador ?? (ctx as any).user?.name ?? "Colaborador",
      });

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
