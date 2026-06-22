import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, emailsGlobais, STATUS_SEM_ALERTA } from "../../drizzle/schema";
import { eq, notInArray } from "drizzle-orm";
import { enviarAlertaVencimento, enviarEmailTeste } from "../services/email";

export const alertasRouter = router({
  // ─── E-mails por Cliente ───────────────────────────────────────────────────

  listarEmails: publicProcedure
    .input(z.object({ clienteId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(emailsAlerta).where(eq(emailsAlerta.clienteId, input.clienteId));
    }),

  adicionarEmail: publicProcedure
    .input(z.object({ clienteId: z.number(), email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.insert(emailsAlerta).values({ clienteId: input.clienteId, email: input.email });
      return { success: true };
    }),

  removerEmail: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.delete(emailsAlerta).where(eq(emailsAlerta.id, input.id));
      return { success: true };
    }),

  // ─── E-mails Globais (recebem alertas de todos os clientes) ───────────────

  listarEmailsGlobais: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(emailsGlobais).orderBy(emailsGlobais.createdAt);
  }),

  adicionarEmailGlobal: publicProcedure
    .input(z.object({
      email: z.string().email("E-mail inválido"),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.insert(emailsGlobais).values({
        email: input.email,
        descricao: input.descricao ?? null,
        ativo: true,
      });
      return { success: true };
    }),

  removerEmailGlobal: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.delete(emailsGlobais).where(eq(emailsGlobais.id, input.id));
      return { success: true };
    }),

  toggleEmailGlobal: publicProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.update(emailsGlobais).set({ ativo: input.ativo }).where(eq(emailsGlobais.id, input.id));
      return { success: true };
    }),

  // ─── Teste de E-mail ───────────────────────────────────────────────────────

  testarEmail: publicProcedure
    .input(z.object({ destinatario: z.string().email() }))
    .mutation(async ({ input }) => {
      return enviarEmailTeste(input.destinatario);
    }),

  // ─── Disparar Alertas ─────────────────────────────────────────────────────

  dispararAlertas: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const marcos = [30, 15, 7, 3, 2, 1];
    let enviados = 0;
    let erros = 0;
    let semEmail = 0;

    // Buscar e-mails globais ativos (recebem todos os alertas)
    const globais = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));
    const emailsGlobaisAtivos = globais.map((g) => g.email);

    // Buscar todos os alvarás ativos que precisam de alerta
    const todosAlvaras = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(notInArray(alvaras.status, STATUS_SEM_ALERTA as string[]));

    for (const { alvara, cliente } of todosAlvaras) {
      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diffMs = vencimento.getTime() - hoje.getTime();
      const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (!marcos.includes(diasRestantes)) continue;

      // Combinar e-mails do cliente + e-mails globais (sem duplicatas)
      const emailsCliente = await db
        .select()
        .from(emailsAlerta)
        .where(eq(emailsAlerta.clienteId, cliente.id));

      const destinatariosCliente = emailsCliente.map((e) => e.email);
      const destinatarios = Array.from(new Set([...destinatariosCliente, ...emailsGlobaisAtivos]));

      if (destinatarios.length === 0) {
        semEmail++;
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

      if (ok) enviados++;
      else erros++;
    }

    return { enviados, erros, semEmail, total: todosAlvaras.length };
  }),

  // ─── Status Geral dos Alertas ─────────────────────────────────────────────

  statusAlertas: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { comEmail: 0, emailsGlobaisAtivos: 0 };

    const comEmail = await db.selectDistinct({ clienteId: emailsAlerta.clienteId }).from(emailsAlerta);
    const globaisAtivos = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));

    return {
      comEmail: comEmail.length,
      emailsGlobaisAtivos: globaisAtivos.length,
    };
  }),
});
