import { z } from "zod";
import { masterProcedure, gestorProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { permissoes } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Mapa de labels amigáveis para módulos e ações
export const MODULOS_LABELS: Record<string, string> = {
  clientes: "Clientes",
  alvaras: "Alvarás",
  pipeline: "Pipeline Comercial",
  exportacao: "Exportação",
  alertas: "Alertas",
  manutencao: "Manutenção",
};

export const ACOES_LABELS: Record<string, string> = {
  visualizar_lista: "Visualizar lista",
  visualizar_detalhe: "Visualizar detalhe",
  marcar_sem_registro: "Marcar/desmarcar 'Sem Registro'",
  atualizar_receita: "Atualizar dados da Receita Federal",
  importar_pdf: "Importar PDF (unitário e lote)",
  revalidar_rfb: "Revalidar conformidade com RFB",
  excluir_alvara: "Excluir alvará",
  visualizar: "Visualizar pipeline",
  criar_negociacao: "Criar/avançar negociação",
  encerrar_negociacao: "Encerrar negociação",
  exportar_relatorios: "Exportar relatórios (XLSX/CSV)",
  visualizar_configuracoes: "Visualizar configurações de alerta",
  disparar_alertas: "Disparar alertas manualmente",
  gerenciar_emails: "Gerenciar e-mails de alerta",
  acessar_painel: "Acessar painel de manutenção",
  reprocessar_pdfs: "Reprocessar PDFs / Revalidar todos",
};

export const permissoesRouter = router({
  /** Lista todas as permissões agrupadas por módulo (somente master e gestor) */
  listar: gestorProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(permissoes).orderBy(permissoes.modulo, permissoes.acao);
    return rows;
  }),

  /** Atualiza uma permissão específica */
  atualizar: masterProcedure
    .input(
      z.object({
        perfil: z.enum(["operator", "gestor", "master"]),
        modulo: z.string(),
        acao: z.string(),
        permitido: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      // Master não pode ter permissões alteradas
      if (input.perfil === "master") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Permissões do Master não podem ser alteradas." });
      }

      // Verificar se a permissão é fixa
      const [perm] = await db
        .select()
        .from(permissoes)
        .where(
          and(
            eq(permissoes.perfil, input.perfil),
            eq(permissoes.modulo, input.modulo),
            eq(permissoes.acao, input.acao)
          )
        )
        .limit(1);

      if (perm?.fixo) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Esta permissão é fixa e não pode ser alterada." });
      }

      await db
        .update(permissoes)
        .set({ permitido: input.permitido })
        .where(
          and(
            eq(permissoes.perfil, input.perfil),
            eq(permissoes.modulo, input.modulo),
            eq(permissoes.acao, input.acao)
          )
        );

      return { ok: true };
    }),

  /** Atualiza permissão do Operador (Gestor também pode fazer isso) */
  atualizarOperador: gestorProcedure
    .input(
      z.object({
        modulo: z.string(),
        acao: z.string(),
        permitido: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });

      // Verificar se a permissão é fixa
      const [perm] = await db
        .select()
        .from(permissoes)
        .where(
          and(
            eq(permissoes.perfil, "operator"),
            eq(permissoes.modulo, input.modulo),
            eq(permissoes.acao, input.acao)
          )
        )
        .limit(1);

      if (perm?.fixo) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Esta permissão é fixa e não pode ser alterada." });
      }

      await db
        .update(permissoes)
        .set({ permitido: input.permitido })
        .where(
          and(
            eq(permissoes.perfil, "operator"),
            eq(permissoes.modulo, input.modulo),
            eq(permissoes.acao, input.acao)
          )
        );

      return { ok: true };
    }),

  /** Retorna as permissões do usuário logado (para uso no frontend) */
  minhasPermissoes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return {};
    const rows = await db
      .select()
      .from(permissoes)
      .where(eq(permissoes.perfil, ctx.user.role));
    // Retorna mapa { "modulo.acao": boolean }
    const mapa: Record<string, boolean> = {};
    for (const row of rows) {
      mapa[`${row.modulo}.${row.acao}`] = row.permitido;
    }
    return mapa;
  }),
});
