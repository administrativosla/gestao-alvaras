import { z } from "zod";
import { gestorProcedure, masterProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { alvaras, clientes, emailsAlerta, emailsGlobais, STATUS_SEM_ALERTA } from "../../drizzle/schema";
import { eq, notInArray } from "drizzle-orm";
import { enviarAlertaVencimento, enviarEmailTeste } from "../services/email";
import { enviarRelatorioAlvaras, enviarEmailConsolidadoAVencer, type ItemRelatorio } from "../services/emailRelatorio";
import * as XLSX from "xlsx";

export const alertasRouter = router({
  // ─── E-mails por Cliente ───────────────────────────────────────────────────

  listarEmails: protectedProcedure
    .input(z.object({ clienteId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(emailsAlerta).where(eq(emailsAlerta.clienteId, input.clienteId));
    }),

  adicionarEmail: masterProcedure
    .input(z.object({ clienteId: z.number(), email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.insert(emailsAlerta).values({ clienteId: input.clienteId, email: input.email });
      return { success: true };
    }),

  removerEmail: masterProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.delete(emailsAlerta).where(eq(emailsAlerta.id, input.id));
      return { success: true };
    }),

  // ─── E-mails Globais (recebem alertas de todos os clientes) ───────────────

  listarEmailsGlobais: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(emailsGlobais).orderBy(emailsGlobais.createdAt);
  }),

  adicionarEmailGlobal: masterProcedure
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

  removerEmailGlobal: masterProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.delete(emailsGlobais).where(eq(emailsGlobais.id, input.id));
      return { success: true };
    }),

  toggleEmailGlobal: masterProcedure
    .input(z.object({ id: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");
      await db.update(emailsGlobais).set({ ativo: input.ativo }).where(eq(emailsGlobais.id, input.id));
      return { success: true };
    }),

  // ─── Teste de E-mail ───────────────────────────────────────────────────────

  testarEmail: masterProcedure
    .input(z.object({ destinatario: z.string().email() }))
    .mutation(async ({ input }) => {
      return enviarEmailTeste(input.destinatario);
    }),

  // ─── Disparar Alertas ─────────────────────────────────────────────────────

  /**
   * Disparo manual de alertas:
   * - Envia para TODOS os alvarás com até 30 dias para vencer (não apenas nos marcos exatos)
   * - Inclui alvarás já vencidos (diasRestantes < 0)
   * - O disparo automático (heartbeat) usa os marcos exatos; o manual usa a janela completa
   */
  dispararAlertas: masterProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let enviados = 0;
    let erros = 0;
    let semEmail = 0;

    // Buscar e-mails globais ativos (recebem todos os alertas)
    const globais = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));
    const emailsGlobaisAtivos = globais.map((g) => g.email);

    // Buscar todos os alvarás que precisam de alerta (excluindo status encerrados)
    const todosAlvaras = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(notInArray(alvaras.status, STATUS_SEM_ALERTA as string[]));

    for (const { alvara, cliente } of todosAlvaras) {
      if (!alvara.dataVencimento) continue;
      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diffMs = vencimento.getTime() - hoje.getTime();
      const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));

      // Disparo manual: envia para todos dentro de 30 dias (inclusive vencidos)
      if (diasRestantes > 30) continue;

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

  // ─── Disparar Relatório Diário Manualmente ────────────────────────────────

  dispararRelatorio: masterProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    const STATUS_EXCLUIDOS = ["Renovado", "Cancelado"];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const globais = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));
    const destinatarios = globais.map((g) => g.email);

    if (destinatarios.length === 0) {
      return { ok: false, motivo: "sem-destinatarios", vencidos: 0, aVencer: 0 };
    }

    const todosAlvaras = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(eq(alvaras.ativo, true));

    const vencidos: ItemRelatorio[] = [];
    const aVencer: ItemRelatorio[] = [];

    for (const { alvara, cliente } of todosAlvaras) {
      if (STATUS_EXCLUIDOS.includes(alvara.status)) continue;
      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const diasParaVencimento = Math.round((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
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
      if (diasParaVencimento < 0) vencidos.push(item);
      else if (diasParaVencimento <= 30) aVencer.push(item);
    }

    vencidos.sort((a, b) => a.diasParaVencimento - b.diasParaVencimento);
    aVencer.sort((a, b) => a.diasParaVencimento - b.diasParaVencimento);

    let ok = false;
    try {
      ok = await enviarRelatorioAlvaras(destinatarios, {
        vencidos,
        aVencer,
        dataRelatorio: new Date(),
      });
    } catch (err: any) {
      throw new Error("Falha ao enviar e-mail: " + (err?.message ?? String(err)));
    }

    return { ok, vencidos: vencidos.length, aVencer: aVencer.length, destinatarios: destinatarios.length };
  }),

  // ─── Exportar Planilha XLSX com Alvarás a Vencer (1–30 dias) ───────────────

  exportarRelatorioAVencer: gestorProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const todosAlvaras = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(eq(alvaras.ativo, true));

    const itens: Array<Record<string, string | number>> = [];

    for (const { alvara, cliente } of todosAlvaras) {
      if (!alvara.dataVencimento) continue;
      if (["Renovado", "Cancelado"].includes(alvara.status)) continue;

      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const dias = Math.round((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      // Apenas alvarás a vencer (1 a 30 dias)
      if (dias < 1 || dias > 30) continue;

      itens.push({
        "Empresa": cliente.razaoSocial,
        "CNPJ": cliente.cnpj,
        "Tipo de Alvará": alvara.tipo,
        "Número do Alvará": alvara.numeroAlvara ?? "",
        "Órgão Emissor": alvara.orgaoEmissor ?? "",
        "Data de Vencimento": vencimento.toLocaleDateString("pt-BR"),
        "Dias para Vencer": dias,
        "Status": alvara.status,
      });
    }

    // Ordenar do mais urgente ao mais distante
    itens.sort((a, b) => (a["Dias para Vencer"] as number) - (b["Dias para Vencer"] as number));

    const ws = XLSX.utils.json_to_sheet(itens);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "A Vencer");

    ws["!cols"] = [
      { wch: 40 }, { wch: 20 }, { wch: 25 }, { wch: 20 },
      { wch: 25 }, { wch: 18 }, { wch: 16 }, { wch: 22 },
    ];

    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const dataStr = new Date().toISOString().split("T")[0];
    return { base64, fileName: `alvaras_a_vencer_${dataStr}.xlsx`, total: itens.length };
  }),

  // ─── Enviar E-mail Consolidado com Alvarás a Vencer (1–30 dias) ─────────────

  enviarEmailConsolidadoAVencer: gestorProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const globais = await db.select().from(emailsGlobais).where(eq(emailsGlobais.ativo, true));
    const destinatarios = globais.map((g) => g.email);

    if (destinatarios.length === 0) {
      return { ok: false, motivo: "sem-destinatarios", total: 0, destinatarios: 0 };
    }

    const todosAlvaras = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eq(alvaras.clienteId, clientes.id))
      .where(eq(alvaras.ativo, true));

    const itens: ItemRelatorio[] = [];

    for (const { alvara, cliente } of todosAlvaras) {
      if (!alvara.dataVencimento) continue;
      if (["Renovado", "Cancelado"].includes(alvara.status)) continue;

      const vencimento = new Date(alvara.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const dias = Math.round((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      // Apenas alvarás a vencer (1 a 30 dias)
      if (dias < 1 || dias > 30) continue;

      itens.push({
        razaoSocial: cliente.razaoSocial,
        cnpj: cliente.cnpj,
        tipoAlvara: alvara.tipo,
        numeroAlvara: alvara.numeroAlvara ?? null,
        dataVencimento: vencimento,
        diasParaVencimento: dias,
        status: alvara.status,
        alvaraId: alvara.id,
      });
    }

    // Ordenar do mais urgente ao mais distante
    itens.sort((a, b) => a.diasParaVencimento - b.diasParaVencimento);

    let ok = false;
    try {
      ok = await enviarEmailConsolidadoAVencer(destinatarios, itens);
    } catch (err: any) {
      throw new Error("Falha ao enviar e-mail: " + (err?.message ?? String(err)));
    }

    return { ok, total: itens.length, destinatarios: destinatarios.length };
  }),

  // ─── Status Geral dos Alertas ─────────────────────────────────────────────

  statusAlertas: protectedProcedure.query(async () => {
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
