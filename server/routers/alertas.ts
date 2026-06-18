import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, STATUS_SEM_ALERTA } from "../../drizzle/schema";
import { eq, notInArray } from "drizzle-orm";

// Envio de e-mail via Manus notification ou SMTP simples
async function enviarEmailAlerta(params: {
  destinatarios: string[];
  razaoSocial: string;
  cnpj: string;
  tipoAlvara: string;
  dataVencimento: Date;
  diasRestantes: number;
}) {
  const { destinatarios, razaoSocial, cnpj, tipoAlvara, dataVencimento, diasRestantes } = params;
  const dataFormatada = dataVencimento.toLocaleDateString("pt-BR");
  const urgencia = diasRestantes <= 3 ? "URGENTE" : diasRestantes <= 7 ? "ATENÇÃO" : "AVISO";

  const assunto = `[${urgencia}] Alvará ${tipoAlvara} - ${razaoSocial} vence em ${diasRestantes} dia(s)`;
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

  // Usar a API de notificação do Manus para envio
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL;
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (!forgeUrl || !forgeKey) {
    console.warn("[Alertas] Variáveis de ambiente de notificação não configuradas.");
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
        return res.ok;
      })
    );
    return results.every((r) => r.status === "fulfilled" && r.value);
  } catch (err) {
    console.error("[Alertas] Erro ao enviar e-mail:", err);
    return false;
  }
}

export const alertasRouter = router({
  // Listar e-mails de alerta de um cliente
  listarEmails: publicProcedure
    .input(z.object({ clienteId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(emailsAlerta).where(eq(emailsAlerta.clienteId, input.clienteId));
    }),

  // Adicionar e-mail de alerta
  adicionarEmail: publicProcedure
    .input(z.object({
      clienteId: z.number(),
      email: z.string().email(),
      nome: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.insert(emailsAlerta).values({
        clienteId: input.clienteId,
        email: input.email,
      });
      return { success: true };
    }),

  // Remover e-mail de alerta
  removerEmail: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.delete(emailsAlerta).where(eq(emailsAlerta.id, input.id));
      return { success: true };
    }),

  // Disparar alertas manualmente (ou chamado pelo heartbeat)
  dispararAlertas: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const marcos = [30, 15, 7, 3, 2, 1];
    let enviados = 0;
    let erros = 0;

    // Buscar todos os alvarás ativos (não em renovação/renovado/cancelado)
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

    for (const { alvara, cliente } of todosAlvaras) {
      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diffMs = vencimento.getTime() - hoje.getTime();
      const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Só envia nos marcos definidos
      if (!marcos.includes(diasRestantes)) continue;

      // Buscar e-mails do cliente
      const emails = await db
        .select()
        .from(emailsAlerta)
        .where(eq(emailsAlerta.clienteId, cliente.id));

      if (emails.length === 0) continue;

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

    return { enviados, erros, total: todosAlvaras.length };
  }),

  // Status dos alertas (quantos alvarás têm e-mails configurados)
  statusAlertas: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { comEmail: 0, semEmail: 0 };

    const comEmail = await db
      .selectDistinct({ clienteId: emailsAlerta.clienteId })
      .from(emailsAlerta);

    return {
      comEmail: comEmail.length,
    };
  }),
});
