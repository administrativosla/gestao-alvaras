import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getResumo, listAlvaras } from "../db";

export const dashboardRouter = router({
  resumo: publicProcedure.query(async () => {
    return getResumo();
  }),

  alertas: publicProcedure.query(async () => {
    const STATUS_SEM_ALERTA = ["Em Renovação", "Renovado", "Cancelado", "Em Vigência"];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const todos = await listAlvaras();

    const comDias = todos
      .map((r) => {
        if (!r.alvara.dataVencimento) return null;
        const venc = new Date(r.alvara.dataVencimento);
        venc.setHours(0, 0, 0, 0);
        const diff = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return { ...r, diasParaVencimento: diff };
      })
      .filter(Boolean) as Array<(typeof todos)[0] & { diasParaVencimento: number }>;

    // Alertas ativos: apenas alvarás sem status que cessa alerta e dentro dos marcos
    const alertas = comDias.filter((r) => {
      if (STATUS_SEM_ALERTA.includes(r.alvara.status)) return false;
      return r.diasParaVencimento <= 30;
    });

    alertas.sort((a, b) => a.diasParaVencimento - b.diasParaVencimento);

    return alertas;
  }),

  /**
   * Próximos vencimentos: alvarás com status "Em Vigência" (> 30 dias),
   * ordenados crescentemente por data de vencimento.
   * Parâmetro `limite` controla quantos registros retornar (padrão: 20).
   */
  proximosVencimentos: publicProcedure
    .input(z.object({ limite: z.number().min(1).max(100).optional() }).optional())
    .query(async ({ input }) => {
      const limite = input?.limite ?? 50;
      // Status que indicam processo encerrado ou cancelado — excluímos da lista
      const STATUS_EXCLUIDOS = ["Renovado", "Cancelado"];
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const todos = await listAlvaras();
      const proximos = todos
        .filter((r) => !STATUS_EXCLUIDOS.includes(r.alvara.status) && r.alvara.dataVencimento)
        .map((r) => {
          const venc = new Date(r.alvara.dataVencimento!);
          venc.setHours(0, 0, 0, 0);
          const diasParaVencimento = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          return { ...r, diasParaVencimento };
        })
        .sort((a, b) => a.diasParaVencimento - b.diasParaVencimento)
        .slice(0, limite);
      return proximos;
    }),

  /**
   * Dados agregados para os gráficos do dashboard.
   * Retorna contagens por status, por tipo e vencimentos por mês (próximos 12 meses).
   */
  graficos: publicProcedure.query(async () => {
    const todos = await listAlvaras();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 1. Distribuição por status
    const porStatus: Record<string, number> = {};
    for (const { alvara } of todos) {
      porStatus[alvara.status] = (porStatus[alvara.status] ?? 0) + 1;
    }
    const distribuicaoStatus = Object.entries(porStatus)
      .map(([status, total]) => ({ status, total }))
      .sort((a, b) => b.total - a.total);

    // 2. Distribuição por tipo
    const porTipo: Record<string, number> = {};
    for (const { alvara } of todos) {
      porTipo[alvara.tipo] = (porTipo[alvara.tipo] ?? 0) + 1;
    }
    const distribuicaoTipo = Object.entries(porTipo)
      .map(([tipo, total]) => ({ tipo, total }))
      .sort((a, b) => b.total - a.total);

    // 3. Vencimentos por mês (próximos 12 meses)
    const STATUS_EXCLUIDOS_GRAFICO = ["Renovado", "Cancelado"];
    const vencimentosPorMes: Record<string, { mes: string; total: number; vencidos: number; aVencer: number }> = {};

    // Inicializar os próximos 12 meses
    for (let i = -1; i <= 11; i++) {
      const d = new Date(hoje);
      d.setDate(1);
      d.setMonth(d.getMonth() + i);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mesLabel = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      vencimentosPorMes[chave] = { mes: mesLabel, total: 0, vencidos: 0, aVencer: 0 };
    }

    for (const { alvara } of todos) {
      if (STATUS_EXCLUIDOS_GRAFICO.includes(alvara.status)) continue;
      if (!alvara.dataVencimento) continue;
      const venc = new Date(alvara.dataVencimento);
      const chave = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}`;
      if (!vencimentosPorMes[chave]) continue;
      vencimentosPorMes[chave].total++;
      const diffDias = Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias < 0) {
        vencimentosPorMes[chave].vencidos++;
      } else {
        vencimentosPorMes[chave].aVencer++;
      }
    }

    const vencimentosMensais = Object.entries(vencimentosPorMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return { distribuicaoStatus, distribuicaoTipo, vencimentosMensais };
  }),
});
