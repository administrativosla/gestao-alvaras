import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, STATUS_SEM_ALERTA } from "../../drizzle/schema";
import { eq, notInArray } from "drizzle-orm";
import { enviarAlertaVencimento, enviarEmailTeste } from "../services/email";

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

  // Testar envio de e-mail (valida credenciais SMTP e envia e-mail de confirmação)
  testarEmail: publicProcedure
    .input(z.object({ destinatario: z.string().email() }))
    .mutation(async ({ input }) => {
      const resultado = await enviarEmailTeste(input.destinatario);
      return resultado;
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
    let semEmail = 0;

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

      if (emails.length === 0) {
        semEmail++;
        continue;
      }

      const destinatarios = emails.map((e) => e.email);

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

      if (ok) enviados++;
      else erros++;
    }

    return { enviados, erros, semEmail, total: todosAlvaras.length };
  }),

  // Status dos alertas (quantos clientes têm e-mails configurados)
  statusAlertas: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { comEmail: 0 };

    const comEmail = await db
      .selectDistinct({ clienteId: emailsAlerta.clienteId })
      .from(emailsAlerta);

    return { comEmail: comEmail.length };
  }),
});
