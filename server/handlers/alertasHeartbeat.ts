import type { Request, Response } from "express";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, emailsGlobais } from "../../drizzle/schema";
import { eq, and, lt, inArray, notInArray } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { enviarAlertaVencimento } from "../services/email";
import { STATUS_SEM_ALERTA } from "../../drizzle/schema";

// Marcos de alerta em dias (enviados individualmente por alvará)
const MARCOS_ALERTA = [30, 15, 7, 3, 2, 1];

export async function alertasHeartbeatHandler(req: Request, res: Response) {
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

    // ─── 1. Transições automáticas de status ────────────────────────────────
    // D+1: alvarás com status "Em Vigência" ou "Iniciar Renovação" que venceram ANTES de hoje → "Vencido"
    const hojeStr = hoje.toISOString().split("T")[0];
    const vencidosParaAtualizar = await db
      .select({ id: alvaras.id })
      .from(alvaras)
      .where(
        and(
          inArray(alvaras.status, ["Em Vigência", "Iniciar Renovação"]),
          lt(alvaras.dataVencimento, hojeStr as any)
        )
      );

    if (vencidosParaAtualizar.length > 0) {
      const ids = vencidosParaAtualizar.map((a) => a.id);
      for (const id of ids) {
        await db.update(alvaras).set({ status: "Vencido" }).where(eq(alvaras.id, id));
      }
      console.log(`[Alertas 8h] ✅ ${vencidosParaAtualizar.length} alvará(s) marcados como Vencido (D+1)`);
    }

    // "Em Vigência" com ≤30 dias para vencer → "Iniciar Renovação"
    const paraIniciarRenovacao = await db
      .select({ id: alvaras.id, dataVencimento: alvaras.dataVencimento })
      .from(alvaras)
      .where(eq(alvaras.status, "Em Vigência"));

    let transicionados = 0;
    for (const row of paraIniciarRenovacao) {
      if (!row.dataVencimento) continue;
      const venc = new Date(row.dataVencimento);
      venc.setHours(0, 0, 0, 0);
      const dias = Math.round((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      if (dias > 0 && dias <= 30) {
        await db.update(alvaras).set({ status: "Iniciar Renovação" }).where(eq(alvaras.id, row.id));
        transicionados++;
      }
    }
    if (transicionados > 0) {
      console.log(`[Alertas 8h] ✅ ${transicionados} alvará(s) transicionados para "Iniciar Renovação"`);
    }

    // ─── 2. Alertas individuais por marco ────────────────────────────────────
    // Envia e-mail individual para cada alvará que está exatamente em um marco (30/15/7/3/2/1 dias)
    const globaisAtivos = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));
    const emailsGlobaisAtivos = globaisAtivos.map((g) => g.email);

    // Buscar todos os alvarás ativos que precisam de alerta (excluindo status sem alerta)
    const todosAlvaras = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(
        and(
          eq(alvaras.ativo, true),
          notInArray(alvaras.status, STATUS_SEM_ALERTA as string[])
        )
      );

    let alertasEnviados = 0;
    let alertasErros = 0;

    for (const { alvara, cliente } of todosAlvaras) {
      if (!alvara.dataVencimento) continue;

      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const dias = Math.round((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      // Verificar se hoje é exatamente um dos marcos de alerta
      if (!MARCOS_ALERTA.includes(dias)) continue;

      // Combinar e-mails do cliente + e-mails globais (sem duplicatas)
      const emailsCliente = await db
        .select()
        .from(emailsAlerta)
        .where(eq(emailsAlerta.clienteId, cliente.id));

      const destinatariosCliente = emailsCliente.map((e) => e.email);
      const destinatarios = Array.from(new Set([...destinatariosCliente, ...emailsGlobaisAtivos]));

      if (destinatarios.length === 0) continue;

      const ok = await enviarAlertaVencimento(destinatarios, {
        razaoSocial: cliente.razaoSocial,
        cnpj: cliente.cnpj,
        tipoAlvara: alvara.tipo,
        numeroAlvara: alvara.numeroAlvara ?? null,
        dataVencimento: vencimento,
        diasParaVencimento: dias,
        statusAtual: alvara.status,
        alvaraId: alvara.id,
      });

      if (ok) {
        alertasEnviados++;
        console.log(`[Alertas 8h] ✅ Marco ${dias}d — ${cliente.razaoSocial} (${alvara.tipo}) → ${destinatarios.length} destinatário(s)`);
      } else {
        alertasErros++;
        console.error(`[Alertas 8h] ❌ Falha ao enviar marco ${dias}d para ${cliente.razaoSocial}`);
      }
    }

    console.log(`[Alertas 8h] Concluído: ${alertasEnviados} alerta(s) enviado(s), ${alertasErros} erro(s), ${transicionados} transição(ões), ${vencidosParaAtualizar.length} vencimento(s) D+1`);

    return res.json({
      ok: true,
      alertasEnviados,
      alertasErros,
      transicionados,
      vencidosAtualizados: vencidosParaAtualizar.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Alertas 8h] Erro fatal:", err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
