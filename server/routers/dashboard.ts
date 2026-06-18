import { publicProcedure, router } from "../_core/trpc";
import { getResumo, listAlvaras } from "../db";

export const dashboardRouter = router({
  resumo: publicProcedure.query(async () => {
    return getResumo();
  }),

  alertas: publicProcedure.query(async () => {
    const STATUS_SEM_ALERTA = ["Em Renovação", "Renovado", "Cancelado"];
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
});
