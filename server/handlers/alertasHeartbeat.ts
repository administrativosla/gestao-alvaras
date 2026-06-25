import type { Request, Response } from "express";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, emailsGlobais, STATUS_SEM_ALERTA } from "../../drizzle/schema";
import { eq, notInArray, and, lt, lte, inArray } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import { enviarAlertaVencimento } from "../services/email";

// Marcos de alerta em dias
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
    // Usa lt (strictly less than) para garantir que o dia do vencimento ainda é válido (D0)
    const hojeStr = hoje.toISOString().split("T")[0]; // YYYY-MM-DD
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
      console.log(`[Alertas Heartbeat] ✅ ${vencidosParaAtualizar.length} alvará(s) marcados como Vencido (D+1)`);
    }

    // "Em Vigência" com ≤30 dias para vencer → "Iniciar Renovação"
    const trintaDias = new Date(hoje);
    trintaDias.setDate(trintaDias.getDate() + 30);
    const trintaDiasStr = trintaDias.toISOString().split("T")[0];
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().split("T")[0];

    // Buscar alvarás Em Vigência que vencem entre amanhã e 30 dias
    const paraIniciarRenovacao = await db
      .select({ id: alvaras.id })
      .from(alvaras)
      .where(eq(alvaras.status, "Em Vigência"));

    let transicionados = 0;
    for (const { id: alvaraId } of paraIniciarRenovacao) {
      const [row] = await db.select({ dataVencimento: alvaras.dataVencimento }).from(alvaras).where(eq(alvaras.id, alvaraId));
      if (!row) continue;
      const venc = new Date(row.dataVencimento);
      venc.setHours(0, 0, 0, 0);
      const diffMs = venc.getTime() - hoje.getTime();
      const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (dias > 0 && dias <= 30) {
        await db.update(alvaras).set({ status: "Iniciar Renovação" }).where(eq(alvaras.id, alvaraId));
        transicionados++;
      }
    }
    if (transicionados > 0) {
      console.log(`[Alertas Heartbeat] ✅ ${transicionados} alvará(s) transicionados para "Iniciar Renovação"`);
    }

    // ─── 2. Alertas de e-mail por marcos ─────────────────────────────────────
    // Buscar todos os alvarás que ainda precisam de alerta (excluindo os que cessaram)
    const todosAlvaras = await db
      .select({
        alvara: alvaras,
        cliente: clientes,
      })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(
        notInArray(alvaras.status, STATUS_SEM_ALERTA as string[])
      );

    // Buscar e-mails globais ativos (recebem todos os alertas)
    const globaisAtivos = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));
    const emailsGlobaisAtivos = globaisAtivos.map((g) => g.email);
    console.log(`[Alertas Heartbeat] E-mails globais ativos: ${emailsGlobaisAtivos.length}`);

    let enviados = 0;
    let ignorados = 0;
    let erros = 0;

    for (const { alvara, cliente } of todosAlvaras) {
      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diffMs = vencimento.getTime() - hoje.getTime();
      const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Só envia nos marcos definidos
      if (!MARCOS_ALERTA.includes(diasRestantes)) {
        ignorados++;
        continue;
      }

      // Buscar e-mails cadastrados para este cliente
      const emailsCliente = await db
        .select()
        .from(emailsAlerta)
        .where(eq(emailsAlerta.clienteId, cliente.id));

      // Combinar e-mails do cliente + globais (sem duplicatas)
      const destinatariosCliente = emailsCliente.map((e) => e.email);
      const destinatarios = Array.from(new Set([...destinatariosCliente, ...emailsGlobaisAtivos]));

      if (destinatarios.length === 0) {
        console.warn(`[Alertas] Cliente ${cliente.razaoSocial} sem e-mails cadastrados e sem globais — alerta ignorado.`);
        ignorados++;
        continue;
      }

      const ok = await enviarAlertaVencimento(destinatarios, {
        razaoSocial: cliente.razaoSocial,
        cnpj: cliente.cnpj,
        tipoAlvara: alvara.tipo,
        numeroAlvara: alvara.numeroAlvara ?? null,
        dataVencimento: vencimento,
        diasParaVencimento: diasRestantes,
        statusAtual: alvara.status,
        alvaraId: alvara.id,
      });

      if (ok) {
        enviados++;
        console.log(`[Alertas] ✅ Alerta enviado: ${cliente.razaoSocial} — ${diasRestantes} dias`);
      } else {
        erros++;
        console.error(`[Alertas] ❌ Falha ao enviar: ${cliente.razaoSocial}`);
      }
    }

    console.log(`[Alertas Heartbeat] Concluído: ${enviados} enviados, ${ignorados} ignorados, ${erros} erros`);
    return res.json({ ok: true, enviados, ignorados, erros, timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error("[Alertas Heartbeat] Erro fatal:", err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
