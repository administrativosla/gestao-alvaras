import type { Request, Response } from "express";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, STATUS_SEM_ALERTA } from "../../drizzle/schema";
import { eq, notInArray } from "drizzle-orm";
import { sdk } from "../_core/sdk";

// Marcos de alerta em dias
const MARCOS_ALERTA = [30, 15, 7, 3, 2, 1];

async function enviarEmailAlerta(params: {
  destinatarios: string[];
  razaoSocial: string;
  cnpj: string;
  tipoAlvara: string;
  dataVencimento: Date;
  diasRestantes: number;
}): Promise<boolean> {
  const { destinatarios, razaoSocial, cnpj, tipoAlvara, dataVencimento, diasRestantes } = params;
  const dataFormatada = dataVencimento.toLocaleDateString("pt-BR");
  const urgencia = diasRestantes <= 3 ? "URGENTE" : diasRestantes <= 7 ? "ATENÇÃO" : "AVISO";

  const assunto = `[${urgencia}] Alvará ${tipoAlvara} — ${razaoSocial} vence em ${diasRestantes} dia(s)`;
  const corpo = `
Prezado(a),

Este é um alerta automático do Sistema de Gestão de Alvarás.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALERTA DE VENCIMENTO DE ALVARÁ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cliente:        ${razaoSocial}
CNPJ:           ${cnpj}
Tipo de Alvará: ${tipoAlvara}
Vencimento:     ${dataFormatada}
Prazo:          ${diasRestantes === 0 ? "VENCE HOJE" : `${diasRestantes} dia(s)`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Por favor, acesse o sistema para verificar e atualizar o status de renovação.

Este e-mail foi gerado automaticamente. Não responda a esta mensagem.
  `.trim();

  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!forgeUrl || !forgeKey) {
    console.warn("[Alertas Heartbeat] Variáveis de ambiente não configuradas.");
    return false;
  }

  try {
    const results = await Promise.allSettled(
      destinatarios.map(async (email) => {
        const res = await fetch(`${forgeUrl}/v1/notification/email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${forgeKey}`,
          },
          body: JSON.stringify({
            to: email,
            subject: assunto,
            text: corpo,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error(`[Alertas] Falha ao enviar para ${email}: ${res.status} ${body}`);
        }
        return res.ok;
      })
    );
    return results.some((r) => r.status === "fulfilled" && r.value);
  } catch (err) {
    console.error("[Alertas Heartbeat] Erro ao enviar e-mail:", err);
    return false;
  }
}

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

    // Buscar todos os alvarás que ainda precisam de alerta
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

      // Buscar e-mails do cliente
      const emails = await db
        .select()
        .from(emailsAlerta)
        .where(eq(emailsAlerta.clienteId, cliente.id));

      if (emails.length === 0) {
        ignorados++;
        continue;
      }

      const destinatarios = emails.map((e) => e.email);
      const ok = await enviarEmailAlerta({
        destinatarios,
        razaoSocial: cliente.razaoSocial,
        cnpj: cliente.cnpj,
        tipoAlvara: alvara.tipo,
        dataVencimento: vencimento,
        diasRestantes,
      });

      if (ok) enviados++;
      else erros++;
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
