import type { Request, Response } from "express";
import { getDb } from "../db";
import { alvaras, clientes, emailsGlobais } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { enviarRelatorioAlvaras, type ItemRelatorio } from "../services/emailRelatorio";

// Status que indicam processo definitivamente encerrado — não entram no relatório
// Nota: "Em Vigência" é mantido para capturar alvarás com data já vencida mas status desatualizado
const STATUS_EXCLUIDOS = ["Renovado", "Cancelado"];

export async function relatorioHeartbeatHandler(req: Request, res: Response) {
  try {
    // Autenticar como cron
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Banco de dados indisponível" });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const em30 = new Date(hoje);
    em30.setDate(em30.getDate() + 30);

    // Buscar todos os alvarás ativos com seus clientes
    const todosAlvaras = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(eq(alvaras.ativo, true));

    // Buscar e-mails globais ativos (destinatários do relatório)
    const globais = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));
    const destinatarios = globais.map((g) => g.email);

    if (destinatarios.length === 0) {
      console.warn("[Relatório Heartbeat] Nenhum e-mail global cadastrado — relatório não enviado.");
      return res.json({
        ok: true,
        skipped: "sem-destinatarios",
        vencidos: 0,
        aVencer: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const vencidos: ItemRelatorio[] = [];
    const aVencer: ItemRelatorio[] = [];

    for (const { alvara, cliente } of todosAlvaras) {
      // Ignorar status que indicam processo encerrado
      if (STATUS_EXCLUIDOS.includes(alvara.status)) continue;

      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diffMs = vencimento.getTime() - hoje.getTime();
      const diasParaVencimento = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const item: ItemRelatorio = {
        razaoSocial: cliente.razaoSocial,
        cnpj: cliente.cnpj,
        tipoAlvara: alvara.tipo,
        numeroAlvara: alvara.numeroAlvara ?? null,
        dataVencimento: vencimento,
        diasParaVencimento,
        status: alvara.status,
        alvaraId: alvara.id,
      };

      if (diasParaVencimento < 0) {
        // Vencido (data já passou)
        vencidos.push(item);
      } else if (diasParaVencimento <= 30) {
        // A vencer nos próximos 30 dias
        aVencer.push(item);
      }
      // Alvarás com > 30 dias não entram no relatório diário
    }

    // Ordenar: vencidos do mais antigo ao mais recente; a vencer do mais próximo ao mais distante
    vencidos.sort((a, b) => a.diasParaVencimento - b.diasParaVencimento);
    aVencer.sort((a, b) => a.diasParaVencimento - b.diasParaVencimento);

    console.log(
      `[Relatório Heartbeat] ${vencidos.length} vencidos, ${aVencer.length} a vencer → enviando para ${destinatarios.length} destinatário(s)`
    );

    let emailOk = false;
    try {
      emailOk = await enviarRelatorioAlvaras(destinatarios, {
        vencidos,
        aVencer,
        dataRelatorio: new Date(),
      });
      if (emailOk) {
        console.log("[Relatório Heartbeat] ✅ Relatório enviado com sucesso.");
      } else {
        console.error("[Relatório Heartbeat] ❌ Falha ao enviar relatório (SMTP retornou false).");
      }
    } catch (emailErr: any) {
      console.error("[Relatório Heartbeat] ❌ Erro ao enviar e-mail:", emailErr?.message ?? emailErr);
      // Não propaga: o job deve retornar 200 mesmo com falha de SMTP
    }

    return res.json({
      ok: emailOk,
      vencidos: vencidos.length,
      aVencer: aVencer.length,
      destinatarios: destinatarios.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Relatório Heartbeat] Erro fatal:", err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
