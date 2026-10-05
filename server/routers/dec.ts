import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { gestorProcedure, protectedProcedure, router } from "../_core/trpc";
import { cancelarDestinacaoDec, corrigirRecebimentoDec, criarRecebimentoDec, listarAuditoriaDec, listarCategoriasDec, listarClientesDec, listarRecebimentosDec, salvarCategoriaDec, salvarDestinacaoDec } from "../dec-db";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data no formato AAAA-MM-DD.").refine(valor => {
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}, "Data inválida.");
const quantidade = z.number().int().positive().max(1_000_000);
const id = z.number().int().positive();
const obs = z.string().trim().max(1000).optional().nullable();
const operador = (user: { id: number; name: string | null }) => ({ id: user.id, nome: user.name || `Usuário ${user.id}` });

export const decRouter = router({
  categorias: protectedProcedure.query(() => listarCategoriasDec()),
  salvarCategoria: gestorProcedure.input(z.object({ id: id.optional(), nome: z.string().trim().min(2).max(120), descricao: z.string().trim().max(500).optional().nullable(), ativa: z.boolean().optional() }))
    .mutation(({ input, ctx }) => salvarCategoriaDec(input, operador(ctx.user))),
  clientes: protectedProcedure.input(z.object({ pesquisa: z.string().trim().max(120).default("") }))
    .query(({ input }) => listarClientesDec(input.pesquisa)),
  listar: protectedProcedure.input(z.object({ inicio: dia, fim: dia, categoriaId: id.optional(), operadorId: id.optional(), clienteId: id.optional() }))
    .query(({ input }) => {
      if (input.inicio > input.fim) throw new TRPCError({ code: "BAD_REQUEST", message: "Período inicial deve ser anterior ao final." });
      return listarRecebimentosDec(input);
    }),
  criarRecebimento: protectedProcedure.input(z.object({ categoriaId: id, dia, quantidade, observacao: obs }))
    .mutation(({ input, ctx }) => criarRecebimentoDec(input, operador(ctx.user))),
  corrigirRecebimento: protectedProcedure.input(z.object({ id, quantidade, observacao: obs }))
    .mutation(({ input, ctx }) => corrigirRecebimentoDec(input, operador(ctx.user))),
  salvarDestinacao: protectedProcedure.input(z.object({
    id: id.optional(), recebimentoId: id,
    tipo: z.enum(["redirecionada_ativo", "arquivada_sem_acao", "arquivada_inativo", "encaminhada_time_interno"]),
    quantidade, clienteId: id.optional().nullable(), observacao: obs,
  })).mutation(({ input, ctx }) => salvarDestinacaoDec(input, operador(ctx.user))),
  cancelarDestinacao: protectedProcedure.input(z.object({ id, recebimentoId: id }))
    .mutation(({ input, ctx }) => cancelarDestinacaoDec(input, operador(ctx.user))),
  auditoria: protectedProcedure.input(z.object({ recebimentoId: id })).query(({ input }) => listarAuditoriaDec(input.recebimentoId)),
});
