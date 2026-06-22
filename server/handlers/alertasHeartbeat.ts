import type { Request, Response } from "express";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, emailsGlobais, STATUS_SEM_ALERTA } from "../../drizzle/schema";
import { eq, notInArray } from "drizzle-orm";
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
