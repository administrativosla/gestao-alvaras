import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { gestorProcedure, protectedProcedure, router } from "../_core/trpc";
import { cancelarDestinacaoDec, corrigirRecebimentoDec, criarRecebimentoDec, criarRecebimentosMultiplosDec, listarAuditoriaDec, listarCategoriasDec, listarClientesDec, listarDirecionamentosDec, listarRecebimentosDec, salvarCategoriaDec, salvarDestinacaoDec, salvarDirecionamentoDec } from "../dec-db";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data no formato AAAA-MM-DD.").refine(valor => {
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}, "Data inválida.");
const quantidade = z.number().int().positive().max(1_000_000);
const id = z.number().int().positive();
const obs = z.string().trim().max(1000).optional().nullable();
const tipoDestino = z.enum(["redirecionada_ativo", "arquivada_sem_acao", "arquivada_inativo", "encaminhada_time_interno", "redirecionada_varias"]);
const novaDestinacao = z.object({ direcionamentoId: id.optional(), tipo: tipoDestino.optional(), quantidade, clienteId: id.optional().nullable(), observacao: obs })
  .refine(input => !!input.direcionamentoId || !!input.tipo, { message: "Selecione um direcionamento.", path: ["direcionamentoId"] });
const recebimentoMultiplo = z.object({ dia, quantidade, observacao: obs });
const operador = (user: { id: number; name: string | null }) => ({ id: user.id, nome: user.name || `Usuário ${user.id}` });

export const decRouter = router({
  categorias: protectedProcedure.query(() => listarCategoriasDec()),
  salvarCategoria: gestorProcedure.input(z.object({ id: id.optional(), nome: z.string().trim().min(2).max(120), descricao: z.string().trim().max(500).optional().nullable(), ativa: z.boolean().optional() }))
    .mutation(({ input, ctx }) => salvarCategoriaDec(input, operador(ctx.user))),
  direcionamentos: protectedProcedure.input(z.object({ somenteAtivos: z.boolean().optional() }).optional())
    .query(({ input }) => listarDirecionamentosDec(input?.somenteAtivos ?? false)),
  salvarDirecionamento: gestorProcedure.input(z.object({
    id: id.optional(), nome: z.string().trim().min(2).max(120), descricao: z.string().trim().max(500).optional().nullable(), tipoBase: tipoDestino, ativa: z.boolean().optional(),
  })).mutation(({ input, ctx }) => salvarDirecionamentoDec(input, operador(ctx.user))),
  clientes: protectedProcedure.input(z.object({ pesquisa: z.string().trim().max(120).default("") }))
    .query(({ input }) => listarClientesDec(input.pesquisa)),
  listar: protectedProcedure.input(z.object({ inicio: dia, fim: dia, categoriaId: id.optional(), operadorId: id.optional(), clienteId: id.optional() }))
    .query(({ input }) => {
      if (input.inicio > input.fim) throw new TRPCError({ code: "BAD_REQUEST", message: "Período inicial deve ser anterior ao final." });
      return listarRecebimentosDec(input);
    }),
  criarRecebimento: protectedProcedure.input(z.object({ categoriaId: id, dia, quantidade, observacao: obs, destinacoes: z.array(novaDestinacao).max(100).optional() })
    .superRefine((input, ctx) => {
      if ((input.destinacoes ?? []).reduce((total, destino) => total + destino.quantidade, 0) > input.quantidade) {
        ctx.addIssue({ code: "custom", message: "As destinações excedem o total de mensagens recebidas.", path: ["destinacoes"] });
      }
    }))
    .mutation(({ input, ctx }) => criarRecebimentoDec(input, operador(ctx.user))),
  criarRecebimentosMultiplos: protectedProcedure.input(z.object({ categoriaId: id, quantidadeTotal: quantidade, recebimentos: z.array(recebimentoMultiplo).min(2).max(100) })
    .superRefine((input, ctx) => {
      const soma = input.recebimentos.reduce((total, recebimento) => total + recebimento.quantidade, 0);
      if (soma !== input.quantidadeTotal) ctx.addIssue({ code: "custom", message: "A soma das quantidades por data deve ser igual ao total informado.", path: ["recebimentos"] });
      const datas = new Set<string>();
      for (let indice = 0; indice < input.recebimentos.length; indice++) {
        const recebimento = input.recebimentos[indice];
        if (datas.has(recebimento.dia)) ctx.addIssue({ code: "custom", message: "Cada data deve aparecer apenas uma vez.", path: ["recebimentos", indice, "dia"] });
        datas.add(recebimento.dia);
      }
    }))
    .mutation(({ input, ctx }) => criarRecebimentosMultiplosDec(input, operador(ctx.user))),
  corrigirRecebimento: protectedProcedure.input(z.object({ id, quantidade, observacao: obs }))
    .mutation(({ input, ctx }) => corrigirRecebimentoDec(input, operador(ctx.user))),
  salvarDestinacao: protectedProcedure.input(z.object({
    id: id.optional(), recebimentoId: id,
    direcionamentoId: id.optional(), tipo: tipoDestino.optional(),
    quantidade, clienteId: id.optional().nullable(), observacao: obs,
  }).refine(input => !!input.direcionamentoId || !!input.tipo, { message: "Selecione um direcionamento.", path: ["direcionamentoId"] }))
    .mutation(({ input, ctx }) => salvarDestinacaoDec(input, operador(ctx.user))),
  cancelarDestinacao: protectedProcedure.input(z.object({ id, recebimentoId: id }))
    .mutation(({ input, ctx }) => cancelarDestinacaoDec(input, operador(ctx.user))),
  auditoria: protectedProcedure.input(z.object({ recebimentoId: id })).query(({ input }) => listarAuditoriaDec(input.recebimentoId)),
});
