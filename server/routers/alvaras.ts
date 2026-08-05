import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import {
  addAlvaraPdf,
  addHistorico,
  createAlvara,
  deleteAlvara,
  getAlvaraById,
  getDb,
  getHistoricoByAlvara,
  listAlvaraPdfs,
  listAlvaras,
  updateAlvara,
} from "../db";
import { alvaras, clientes } from "../../drizzle/schema";
import { eq as eqDrizzle, and as andDrizzle } from "drizzle-orm";
import { STATUS_RENOVACAO, emailsAlerta, emailsGlobais } from "../../drizzle/schema";
import { parseDate } from "../utils/parseDate";
import { enviarNotificacaoStatusAtualizado } from "../services/email";
import { executarValidacao, validacaoParaCampos } from "../validation";
import { getClienteById } from "../db";
import { invokeLLM } from "../_core/llm";

const statusEnum = z.enum(STATUS_RENOVACAO);

const alvaraSchema = z.object({
  clienteId: z.number(),
  numeroAlvara: z.string().max(100).optional().nullable(),
  tipo: z.string().min(1).max(50),
  orgaoEmissor: z.string().max(255).optional().nullable(),
  dataEmissao: z.string().optional().nullable(),
  dataVencimento: z.string().min(1),
  arquivoPdfKey: z.string().max(500).optional().nullable(),
  arquivoPdfUrl: z.string().max(500).optional().nullable(),
  // Campos específicos do CLI (SP) — opcionais para outros tipos
  cliProtocolo: z.string().max(50).optional().nullable(),
  cliNumeroSolicitacao: z.string().max(50).optional().nullable(),
  cliDataSolicitacao: z.string().optional().nullable(),
  cliInscricaoMunicipal: z.string().max(50).optional().nullable(),
  cliNaturezaJuridica: z.string().max(100).optional().nullable(),
  cliFormaAtuacao: z.string().max(255).optional().nullable(),
  cliAreaEstabelecimento: z.string().max(30).optional().nullable(),
  cliCnaesLicenciados: z.string().optional().nullable(), // JSON string
  cliComponentes: z.string().optional().nullable(),      // JSON string
  // Situação do CLI ("completo" | "parcial" | "nao_avaliado" | null)
  situacaoCli: z.string().max(20).optional().nullable(),
  pendenciaRegularizacao: z.boolean().optional(),
  motivoPendenciaCli: z.string().optional().nullable(),
});

export const alvarasRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          clienteId: z.number().optional(),
          status: z.string().optional(),
          tipo: z.string().optional(),
          diasVencimento: z.number().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listAlvaras(input);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const row = await getAlvaraById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const historico = await getHistoricoByAlvara(input.id);
      return { ...row, historico };
    }),

  create: publicProcedure.input(alvaraSchema).mutation(async ({ input, ctx }) => {
    const { dataEmissao, dataVencimento, cliDataSolicitacao, ...rest } = input;
    const parsedVenc = parseDate(dataVencimento) ?? new Date(dataVencimento);
    // Determina status inicial: "Em Vigência" se vencer em mais de 30 dias, "Vencido" caso contrário
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(parsedVenc);
    venc.setHours(0, 0, 0, 0);
    const diasParaVencimento = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const statusInicial: string = diasParaVencimento > 30 ? "Em Vigência" : "Vencido";
    const id = await createAlvara({
      ...rest,
      dataEmissao: parseDate(dataEmissao) ?? null,
      dataVencimento: parsedVenc,
      cliDataSolicitacao: parseDate(cliDataSolicitacao) ?? null,
      status: statusInicial,
    });
    await addHistorico({
      alvaraId: id,
      statusAnterior: null,
      statusNovo: statusInicial,
      observacao: statusInicial === "Em Vigência"
        ? `Alvará cadastrado. Em vigência até ${parsedVenc.toLocaleDateString("pt-BR")}.`
        : "Alvará cadastrado. Vencimento próximo — atenção necessária.",
      colaborador: (ctx as any).user?.name ?? "Sistema",
    });
    return { id };
  }),

  update: publicProcedure
    .input(z.object({ id: z.number(), data: alvaraSchema.partial() }))
    .mutation(async ({ input, ctx }) => {
      const { dataEmissao, dataVencimento, cliDataSolicitacao, ...rest } = input.data;

      // Buscar o alvará atual para comparar situacaoCli e recalcular status se necessário
      const current = await getAlvaraById(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });

      // TRAVA: situacaoCli só pode ser alterado para "completo" via importação de PDF
      // Qualquer tentativa manual de marcar como completo é bloqueada aqui
      if (input.data.situacaoCli === "completo" && current.alvara.situacaoCli !== "completo") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Para marcar o CLI como completo, é obrigatório fazer o upload do documento CLI definitivo. O sistema realizará a leitura e atualização automática.",
        });
      }

      const updateData: Parameters<typeof updateAlvara>[1] = {
        ...rest,
        dataEmissao: dataEmissao !== undefined ? (parseDate(dataEmissao) ?? undefined) : undefined,
        dataVencimento: dataVencimento !== undefined ? (parseDate(dataVencimento) ?? undefined) : undefined,
        cliDataSolicitacao: cliDataSolicitacao !== undefined ? (parseDate(cliDataSolicitacao) ?? undefined) : undefined,
      };

      // Quando situacaoCli muda de "parcial" para "completo", recalcular status automaticamente
      const novaSituacao = input.data.situacaoCli;
      const situacaoAnterior = current.alvara.situacaoCli;
      if (novaSituacao === "completo" && situacaoAnterior === "parcial") {
        // Limpar flags de pendência
        updateData.pendenciaRegularizacao = false;
        updateData.motivoPendenciaCli = null;

        // Recalcular status baseado na data de vencimento
        const dataVenc = dataVencimento
          ? (parseDate(dataVencimento) ?? current.alvara.dataVencimento)
          : current.alvara.dataVencimento;
        if (dataVenc) {
          const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
          const venc = new Date(dataVenc); venc.setHours(0, 0, 0, 0);
          const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          if (dias > 30) {
            updateData.status = "Em Vigência";
          } else if (dias >= 0) {
            updateData.status = "A Vencer";
          } else {
            updateData.status = "Vencido";
          }
        }
      }

      await updateAlvara(input.id, updateData);

      // Registrar histórico quando CLI muda de parcial para completo
      if (novaSituacao === "completo" && situacaoAnterior === "parcial") {
        await addHistorico({
          alvaraId: input.id,
          statusAnterior: current.alvara.status,
          statusNovo: updateData.status ?? current.alvara.status,
          observacao: "CLI atualizado de Parcial para Completo. Cobertura recalculada automaticamente.",
          colaborador: (ctx as any).user?.name ?? "Sistema",
        });
      }

      return { success: true };
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.number(),
        status: statusEnum,
        observacao: z.string().optional(),
        colaborador: z.string().optional(),
        novaDataVencimento: z.string().optional(), // obrigatório quando status = "Renovado"
      })
    )
    .mutation(async ({ input, ctx }) => {
      const row = await getAlvaraById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      // Ao marcar como Renovado, exige nova data de vencimento
      if (input.status === "Renovado" && !input.novaDataVencimento) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe a nova data de vencimento para concluir a renovação.",
        });
      }

      const statusAnterior = row.alvara.status;
      const responsavel = input.colaborador ?? (ctx as any).user?.name ?? "Colaborador";

      // Monta o objeto de atualização
      const updateData: Parameters<typeof updateAlvara>[1] = { status: input.status };
      if (input.status === "Renovado" && input.novaDataVencimento) {
        const novaData = parseDate(input.novaDataVencimento);
        if (!novaData) throw new TRPCError({ code: "BAD_REQUEST", message: "Data de vencimento inválida." });
        updateData.dataVencimento = novaData;
      }

      await updateAlvara(input.id, updateData);
      await addHistorico({
        alvaraId: input.id,
        statusAnterior,
        statusNovo: input.status,
        observacao: input.observacao ?? null,
        colaborador: responsavel,
      });

      // Disparo de e-mail fire-and-forget (não bloqueia a resposta ao usuário)
      const dataVencimentoFinal = updateData.dataVencimento ?? new Date(row.alvara.dataVencimento);
      const clienteId = row.alvara.clienteId;
      const emailPayload = {
        razaoSocial: row.cliente.razaoSocial,
        cnpj: row.cliente.cnpj,
        tipoAlvara: row.alvara.tipo,
        numeroAlvara: row.alvara.numeroAlvara ?? null,
        statusAnterior,
        statusNovo: input.status,
        responsavel,
        observacao: input.observacao ?? null,
        dataVencimento: dataVencimentoFinal,
      };

      (async () => {
        try {
          const db = await getDb();
          if (!db) return;

          // Busca e-mails do cliente
          const emailsDoCliente = await db
            .select()
            .from(emailsAlerta)
            .where(eq(emailsAlerta.clienteId, clienteId));

          // Busca e-mails globais ativos
          const globais = await db
            .select()
            .from(emailsGlobais)
            .where(eq(emailsGlobais.ativo, true));

          const destinatarios = Array.from(
            new Set([
              ...emailsDoCliente.map((e) => e.email),
              ...globais.map((g) => g.email),
            ])
          );

          if (destinatarios.length === 0) return;

          await enviarNotificacaoStatusAtualizado(destinatarios, emailPayload);
        } catch (emailErr) {
          console.error("[updateStatus] Falha ao enviar e-mail de notificação:", emailErr);
        }
      })();

      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAlvara(input.id);
      return { success: true };
    }),

  getHistorico: publicProcedure
    .input(z.object({ alvaraId: z.number() }))
    .query(async ({ input }) => {
      return getHistoricoByAlvara(input.alvaraId);
    }),

  listCliParciais: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ alvara: alvaras, cliente: clientes })
      .from(alvaras)
      .innerJoin(clientes, eqDrizzle(alvaras.clienteId, clientes.id))
      .where(
        andDrizzle(
          eqDrizzle(alvaras.ativo, true),
          eqDrizzle(alvaras.situacaoCli as any, "parcial")
        )
      );
    return rows.map((r) => {
      let orgaosPendentes: any[] | null = null;
      try {
        if ((r.alvara as any).cliOrgaosPendentes) {
          orgaosPendentes = JSON.parse((r.alvara as any).cliOrgaosPendentes);
        }
      } catch { /* ignore */ }
      const totalPendentes = orgaosPendentes?.filter((o: any) => o.status === "pendente").length ?? 0;
      return {
        id: r.alvara.id,
        razaoSocial: r.cliente.razaoSocial,
        cnpj: r.cliente.cnpj,
        clienteId: r.cliente.id,
        numeroAlvara: r.alvara.numeroAlvara,
        dataVencimento: r.alvara.dataVencimento,
        motivoPendenciaCli: (r.alvara as any).motivoPendenciaCli ?? null,
        status: r.alvara.status,
        cliOrgaosPendentes: orgaosPendentes,
        totalOrgaosPendentes: totalPendentes,
        arquivoPdfUrl: (r.alvara as any).arquivoPdfUrl ?? null,
      };
    });
  }),

  // Resolve uma pendência específica de órgão no CLI parcial
  resolverPendenciaOrgao: publicProcedure
    .input(z.object({
      alvaraId: z.number(),
      orgao: z.string(),
      observacao: z.string().optional(),
      colaborador: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const row = await getAlvaraById(input.alvaraId);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const responsavel = input.colaborador ?? (ctx as any).user?.name ?? "Sistema";
      const agora = new Date().toISOString();

      // Atualizar a pendência do órgão específico
      let orgaos: any[] = [];
      try {
        if ((row.alvara as any).cliOrgaosPendentes) {
          orgaos = JSON.parse((row.alvara as any).cliOrgaosPendentes);
        }
      } catch { /* ignore */ }

      const idx = orgaos.findIndex((o: any) => o.orgao === input.orgao);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Orgão não encontrado nas pendências." });

      orgaos[idx] = {
        ...orgaos[idx],
        status: "resolvido",
        resolvidoEm: agora,
        resolvidoPor: responsavel,
        observacao: input.observacao ?? null,
      };

      const todosResolvidos = orgaos.every((o: any) => o.status === "resolvido");

      await updateAlvara(input.alvaraId, {
        cliOrgaosPendentes: JSON.stringify(orgaos),
        // Se todos resolvidos, limpar flag de pendência
        ...(todosResolvidos ? { pendenciaRegularizacao: false } : {}),
      });

      await addHistorico({
        alvaraId: input.alvaraId,
        statusAnterior: row.alvara.status,
        statusNovo: row.alvara.status,
        observacao: `Pendência resolvida: ${input.orgao}${input.observacao ? ` — ${input.observacao}` : ""}.${todosResolvidos ? " Todos os órgãos resolvidos! CLI pronto para ser marcado como completo." : ""}`,
        colaborador: responsavel,
      });

      return { success: true, todosResolvidos };
    }),

  // Revalida um alvará cruzando com os dados atuais da Receita Federal
  revalidar: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const row = await getAlvaraById(input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const clienteData = await getClienteById(row.alvara.clienteId);
      if (!clienteData) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });

      // Parsear CNAEs licenciados armazenados no alvará
      let cliCnaesLicenciados: string[] | null = null;
      if (row.alvara.cliCnaesLicenciados) {
        try { cliCnaesLicenciados = JSON.parse(row.alvara.cliCnaesLicenciados); } catch { /* ignorar */ }
      }

      // Se CLI sem CNAEs e PDF disponível, reextrair via LLM
      const arquivoPdfUrl = (row.alvara as any).arquivoPdfUrl as string | null;
      if (!cliCnaesLicenciados && row.alvara.tipo === "CLI" && arquivoPdfUrl) {
        try {
          const llmResp = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `Você é um extrator de dados de documentos de licenciamento municipal (CLI). Extraia APENAS os códigos CNAE licenciados deste documento. Procure em DUAS seções: (1) seção "ATIVIDADES ECONÔMICAS LICENCIADAS" no formato "6203100 - Descrição"; (2) seção "PARECER DA PREFEITURA" no formato "CNAE: 6203-1/00-Descrição". Retorne apenas os dígitos numéricos de cada código (ex: "6203100", "6202300"). Use a seção com mais entradas.`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "file_url" as const,
                    file_url: { url: arquivoPdfUrl, mime_type: "application/pdf" as const },
                  },
                  { type: "text" as const, text: "Extraia os códigos CNAE licenciados deste CLI e retorne apenas o JSON." },
                ] as any,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "cnae_extraction",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    cliCnaesLicenciados: { type: ["array", "null"], items: { type: "string" } },
                  },
                  required: ["cliCnaesLicenciados"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = llmResp.choices[0]?.message?.content;
          if (content && typeof content === "string") {
            const parsed = JSON.parse(content);
            if (parsed.cliCnaesLicenciados && parsed.cliCnaesLicenciados.length > 0) {
              cliCnaesLicenciados = parsed.cliCnaesLicenciados;
              // Salvar no banco para não precisar reextrair novamente
              await updateAlvara(input.id, {
                cliCnaesLicenciados: JSON.stringify(cliCnaesLicenciados),
              });
            }
          }
        } catch (e) {
          console.error("[Revalidar] Erro ao reextrair CNAEs do PDF", input.id, e);
        }
      }

      const validacao = executarValidacao(
        {
          // Endereço vem do cliente (alvarás não armazenam endereço próprio)
          logradouro: clienteData.logradouro ?? null,
          numero: clienteData.numero ?? null,
          bairro: clienteData.bairro ?? null,
          cidade: clienteData.cidade ?? null,
          uf: clienteData.uf ?? null,
          cep: clienteData.cep ?? null,
          tipo: row.alvara.tipo ?? null,
          orgaoEmissor: row.alvara.orgaoEmissor ?? null,
          cliCnaesLicenciados,
        },
        {
          situacaoCadastral: clienteData.situacaoCadastral,
          logradouro: clienteData.logradouro,
          numero: clienteData.numero,
          bairro: clienteData.bairro,
          cidade: clienteData.cidade,
          uf: clienteData.uf,
          cep: clienteData.cep,
          cnaePrincipal: clienteData.cnaePrincipal,
          cnaePrincipalDescricao: clienteData.cnaePrincipalDescricao,
          cnaesSecundarios: clienteData.cnaesSecundarios,
        }
      );

      await updateAlvara(input.id, validacaoParaCampos(validacao));
      return { success: true, validacao };
    }),

  // Desfaz a resolução de uma pendência de órgão (reverte para "pendente")
  desfazerResolucaoOrgao: publicProcedure
    .input(z.object({
      alvaraId: z.number(),
      orgao: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const row = await getAlvaraById(input.alvaraId);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      const responsavel = (ctx as any).user?.name ?? "Sistema";

      let orgaos: any[] = [];
      try {
        if ((row.alvara as any).cliOrgaosPendentes) {
          orgaos = JSON.parse((row.alvara as any).cliOrgaosPendentes);
        }
      } catch { /* ignore */ }

      const idx = orgaos.findIndex((o: any) => o.orgao === input.orgao);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Órgão não encontrado nas pendências." });
      if (orgaos[idx].status !== "resolvido") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este órgão já está pendente." });
      }

      orgaos[idx] = {
        ...orgaos[idx],
        status: "pendente",
        resolvidoEm: null,
        resolvidoPor: null,
        observacao: null,
      };

      await updateAlvara(input.alvaraId, {
        cliOrgaosPendentes: JSON.stringify(orgaos),
        pendenciaRegularizacao: true,
      });

      await addHistorico({
        alvaraId: input.alvaraId,
        statusAnterior: row.alvara.status,
        statusNovo: row.alvara.status,
        observacao: `Resolução desfeita: ${input.orgao} voltou para pendente. Ação realizada por ${responsavel}.`,
        colaborador: responsavel,
      });

      return { success: true };
    }),

  // Listar histórico de PDFs de um alvará
  listPdfs: publicProcedure
    .input(z.object({ alvaraId: z.number() }))
    .query(async ({ input }) => {
      return listAlvaraPdfs(input.alvaraId);
    }),

  // Registrar um PDF no histórico (chamado internamente após upload)
  addPdf: publicProcedure
    .input(z.object({
      alvaraId: z.number(),
      fileName: z.string(),
      pdfKey: z.string(),
      pdfUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await addAlvaraPdf({
        alvaraId: input.alvaraId,
        fileName: input.fileName,
        pdfKey: input.pdfKey,
        pdfUrl: input.pdfUrl,
        uploadedBy: (ctx as any).user?.name ?? "Sistema",
      });
      return { id };
    }),
});
