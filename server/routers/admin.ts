/**
 * admin.ts — Rotinas de manutenção e varredura retroativa
 *
 * SKILL PERMANENTE: Toda nova melhoria que adicionar campos extraídos do PDF
 * deve ser refletida aqui para que o banco existente seja atualizado sem
 * necessidade de reimportação manual.
 *
 * Procedures disponíveis (apenas MASTER):
 *   - admin.statusVarredura   → estatísticas do banco (campos faltantes, etc.)
 *   - admin.reprocessarPdfs  → rele PDFs do storage e preenche campos faltantes
 *   - admin.revalidarTodos   → roda executarValidacao em todos os alvarás
 */

import { z } from "zod";
import { masterProcedure, router } from "../_core/trpc";
import { getDb, updateAlvara, getClienteById } from "../db";
import { alvaras } from "../../drizzle/schema";
import { isNull, or, eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storageGetSignedUrl } from "../storage";
import { executarValidacao, validacaoParaCampos } from "../validation";
import { ENV } from "../_core/env";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Baixa um PDF do storage como base64.
 * Tenta primeiro via URL pública /manus-storage/, depois via presigned URL.
 */
async function downloadPdfAsBase64(pdfUrl: string, pdfKey: string): Promise<string | null> {
  try {
    // Tentar via presigned URL (mais confiável no servidor)
    const signedUrl = await storageGetSignedUrl(pdfKey).catch(() => null);
    const targetUrl = signedUrl ?? (
      // Fallback: construir URL absoluta a partir da URL relativa
      pdfUrl.startsWith("/manus-storage/")
        ? `${ENV.forgeApiUrl.replace(/\/+$/, "")}/v1/storage/proxy/${pdfKey}`
        : pdfUrl
    );

    const resp = await fetch(targetUrl, {
      headers: signedUrl ? {} : { Authorization: `Bearer ${ENV.forgeApiKey}` },
    });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch {
    return null;
  }
}

/**
 * Extrai campos específicos de um PDF via LLM.
 * Usado para enriquecimento retroativo — apenas extrai o que está faltando.
 */
async function extrairCamposDosPdf(fileBase64: string): Promise<{
  cliMunicipioEmissor?: string | null;
  tipo?: string | null;
  orgaoEmissor?: string | null;
  cidade?: string | null;
  cep?: string | null;
  uf?: string | null;
  cliCnaesLicenciados?: string[] | null;
  situacaoCli?: string | null;
} | null> {
  try {
    const fileUrl = `data:application/pdf;base64,${fileBase64}`;
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Você é um assistente especializado em extrair dados de documentos de licenciamento empresarial brasileiros.

Extraia APENAS os seguintes campos do documento:
- tipo: "CLI" para Certificado de Licenciamento Integrado, ou o tipo do alvará (ex: "Funcionamento", "Sanitário")
- orgaoEmissor: órgão emissor do documento (ex: "Prefeitura de São Paulo / VRE-SP")
- cidade: município do endereço do estabelecimento
- cep: CEP do endereço do estabelecimento
- uf: UF do endereço (2 letras)
- cliMunicipioEmissor: SOMENTE para documentos CLI. Nome do município emissor extraído do cabeçalho "Prefeitura do Município de [NOME]" ou "Prefeitura de [NOME]". Exemplos: "Barueri", "São Paulo". IMPORTANTE: o prefixo SPM/SPP no número do protocolo NÃO indica o município — é apenas o tipo de protocolo do sistema VRE/REDESIM. Para documentos que não são CLI, retorne null.
- cliCnaesLicenciados: SOMENTE para CLI. Array de códigos CNAE licenciados (apenas números, ex: ["62031", "47296"]). Para não-CLI, retorne null.
- situacaoCli: SOMENTE para CLI. "parcial" se contiver "PENDENTE DE FINALIZAÇÃO", "documento parcial" ou "não produz os efeitos legais". Caso contrário "completo". Para não-CLI, retorne null.

Se não encontrar um campo, use null.`,
        },
        {
          role: "user",
          content: [
            {
              type: "file_url" as const,
              file_url: { url: fileUrl, mime_type: "application/pdf" as const },
            },
            {
              type: "text" as const,
              text: "Extraia os campos solicitados e retorne apenas o JSON.",
            },
          ] as any,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "campos_pdf",
          strict: true,
          schema: {
            type: "object",
            properties: {
              tipo: { type: ["string", "null"] },
              orgaoEmissor: { type: ["string", "null"] },
              cidade: { type: ["string", "null"] },
              cep: { type: ["string", "null"] },
              uf: { type: ["string", "null"] },
              cliMunicipioEmissor: { type: ["string", "null"] },
              cliCnaesLicenciados: { type: ["array", "null"], items: { type: "string" } },
              situacaoCli: { type: ["string", "null"] },
            },
            required: ["tipo", "orgaoEmissor", "cidade", "cep", "uf", "cliMunicipioEmissor", "cliCnaesLicenciados", "situacaoCli"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) return null;
    const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    return JSON.parse(contentStr);
  } catch {
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const adminRouter = router({

  /**
   * Retorna estatísticas do banco para o painel de manutenção.
   */
  statusVarredura: masterProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");
    const todos = await db.select({
      id: alvaras.id,
      tipo: alvaras.tipo,
      arquivoPdfKey: alvaras.arquivoPdfKey,
      arquivoPdfUrl: alvaras.arquivoPdfUrl,
      cliMunicipioEmissor: alvaras.cliMunicipioEmissor,
      validacaoEndereco: alvaras.validacaoEndereco,
      validacaoCnae: alvaras.validacaoCnae,
      validacaoSituacao: alvaras.validacaoSituacao,
    }).from(alvaras);

    const total = todos.length;
    const comPdf = todos.filter(a => a.arquivoPdfKey && a.arquivoPdfUrl).length;
    const semPdf = total - comPdf;
    const cliSemMunicipio = todos.filter(a =>
      a.tipo === "CLI" && a.arquivoPdfKey && !a.cliMunicipioEmissor
    ).length;
    const semValidacao = todos.filter(a =>
      !a.validacaoEndereco || a.validacaoEndereco === "nao_verificado"
    ).length;

    return {
      total,
      comPdf,
      semPdf,
      cliSemMunicipio,
      semValidacao,
      precisaReprocessar: cliSemMunicipio,
      precisaRevalidar: semValidacao,
    };
  }),

  /**
   * Reprocessa PDFs armazenados para preencher campos faltantes.
   * Rele cada PDF do storage via LLM e atualiza o banco.
   * Retorna log detalhado de cada alvará processado.
   */
  reprocessarPdfs: masterProcedure
    .input(z.object({
      apenasCliSemMunicipio: z.boolean().default(true),
      limite: z.number().min(1).max(200).default(50),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");

      const candidatos = await db.select({
        id: alvaras.id,
        tipo: alvaras.tipo,
        clienteId: alvaras.clienteId,
        arquivoPdfKey: alvaras.arquivoPdfKey,
        arquivoPdfUrl: alvaras.arquivoPdfUrl,
        cliMunicipioEmissor: alvaras.cliMunicipioEmissor,
        cliCnaesLicenciados: alvaras.cliCnaesLicenciados,
        situacaoCli: alvaras.situacaoCli,
        orgaoEmissor: alvaras.orgaoEmissor,
      }).from(alvaras)
        .limit(input.limite);

      // Filtrar: apenas os que têm PDF e precisam de reprocessamento
      const alvosReprocessar = candidatos.filter((a: typeof candidatos[0]) => {
        if (!a.arquivoPdfKey || !a.arquivoPdfUrl) return false;
        if (input.apenasCliSemMunicipio) {
          return a.tipo === "CLI" && !a.cliMunicipioEmissor;
        }
        return true;
      });

      const log: Array<{
        alvaraId: number;
        status: "ok" | "sem_pdf" | "erro_download" | "erro_llm" | "sem_mudanca";
        camposAtualizados: string[];
        mensagem: string;
      }> = [];

      for (const alvara of alvosReprocessar) {
        if (!alvara.arquivoPdfKey || !alvara.arquivoPdfUrl) {
          log.push({ alvaraId: alvara.id, status: "sem_pdf", camposAtualizados: [], mensagem: "Sem PDF armazenado" });
          continue;
        }

        // Baixar PDF do storage
        const base64 = await downloadPdfAsBase64(alvara.arquivoPdfUrl, alvara.arquivoPdfKey);
        if (!base64) {
          log.push({ alvaraId: alvara.id, status: "erro_download", camposAtualizados: [], mensagem: "Falha ao baixar PDF do storage" });
          continue;
        }

        // Extrair campos via LLM
        const campos = await extrairCamposDosPdf(base64);
        if (!campos) {
          log.push({ alvaraId: alvara.id, status: "erro_llm", camposAtualizados: [], mensagem: "Falha na extração via LLM" });
          continue;
        }

        // Determinar quais campos precisam ser atualizados
        const updates: Record<string, any> = {};
        const camposAtualizados: string[] = [];

        if (campos.cliMunicipioEmissor && !alvara.cliMunicipioEmissor) {
          updates.cliMunicipioEmissor = campos.cliMunicipioEmissor;
          camposAtualizados.push(`cliMunicipioEmissor="${campos.cliMunicipioEmissor}"`);
        }
        if (campos.cliCnaesLicenciados && campos.cliCnaesLicenciados.length > 0 && !alvara.cliCnaesLicenciados) {
          updates.cliCnaesLicenciados = JSON.stringify(campos.cliCnaesLicenciados);
          camposAtualizados.push(`cliCnaesLicenciados=[${campos.cliCnaesLicenciados.join(",")}]`);
        }
        if (campos.situacaoCli && !alvara.situacaoCli) {
          updates.situacaoCli = campos.situacaoCli;
          camposAtualizados.push(`situacaoCli="${campos.situacaoCli}"`);
        }
        // Nota: campos de endereço (cidade, cep, uf) ficam na tabela clientes, não em alvaras.
        // Apenas campos específicos do CLI são atualizados aqui.

        if (Object.keys(updates).length === 0) {
          log.push({ alvaraId: alvara.id, status: "sem_mudanca", camposAtualizados: [], mensagem: "Nenhum campo novo encontrado" });
          continue;
        }

        await updateAlvara(alvara.id, updates);

        // Após atualizar campos, executar revalidação automática
        try {
          const clienteData = await getClienteById(alvara.clienteId);
          if (clienteData) {
            const validacao = executarValidacao(
              {
                cidade: campos.cidade ?? undefined,
                cep: campos.cep ?? undefined,
                uf: campos.uf ?? undefined,
                tipo: campos.tipo ?? alvara.tipo ?? undefined,
                orgaoEmissor: campos.orgaoEmissor ?? undefined,
                cliCnaesLicenciados: campos.cliCnaesLicenciados ?? null,
                ...({ cliMunicipioEmissor: campos.cliMunicipioEmissor ?? null } as any),
              } as any,
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
            await updateAlvara(alvara.id, validacaoParaCampos(validacao));
            camposAtualizados.push("validação_atualizada");
          }
        } catch { /* validação não bloqueia */ }

        log.push({
          alvaraId: alvara.id,
          status: "ok",
          camposAtualizados,
          mensagem: `Atualizado: ${camposAtualizados.join(", ")}`,
        });
      }

      const resumo = {
        total: alvosReprocessar.length,
        atualizados: log.filter(l => l.status === "ok").length,
        semMudanca: log.filter(l => l.status === "sem_mudanca").length,
        erros: log.filter(l => ["erro_download", "erro_llm"].includes(l.status)).length,
      };

      return { resumo, log };
    }),

  /**
   * Revalida todos os alvarás contra a Receita Federal.
   * Não rele PDFs — usa os dados já armazenados no banco.
   * Útil para aplicar melhorias na lógica de validação sem reimportar.
   */
  revalidarTodos: masterProcedure
    .input(z.object({
      limite: z.number().min(1).max(500).default(100),
      apenasNaoValidados: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados indisponível");

      const candidatos = await db.select({
        id: alvaras.id,
        clienteId: alvaras.clienteId,
        tipo: alvaras.tipo,
        orgaoEmissor: alvaras.orgaoEmissor,
        cliMunicipioEmissor: alvaras.cliMunicipioEmissor,
        cliCnaesLicenciados: alvaras.cliCnaesLicenciados,
        validacaoEndereco: alvaras.validacaoEndereco,
      }).from(alvaras)
        .limit(input.limite);

      type Candidato = typeof candidatos[0];
      const alvos: Candidato[] = input.apenasNaoValidados
        ? candidatos.filter((a: Candidato) => !a.validacaoEndereco || a.validacaoEndereco === "nao_verificado")
        : candidatos;

      const log: Array<{
        alvaraId: number;
        status: "ok" | "sem_cliente" | "erro";
        resultado: string;
      }> = [];

      for (const alvara of alvos) {
        try {
          const clienteData = await getClienteById(alvara.clienteId);
          if (!clienteData) {
            log.push({ alvaraId: alvara.id, status: "sem_cliente", resultado: "Cliente não encontrado" });
            continue;
          }

          const cnaesLicenciados = alvara.cliCnaesLicenciados
            ? (() => { try { return JSON.parse(alvara.cliCnaesLicenciados); } catch { return null; } })()
            : null;

          const validacao = executarValidacao(
            {
              // Campos de endereço ficam no cliente, não no alvará
              // Passamos apenas os campos CLI específicos do alvará
              tipo: alvara.tipo ?? undefined,
              orgaoEmissor: alvara.orgaoEmissor ?? undefined,
              cliCnaesLicenciados: cnaesLicenciados,
              ...({ cliMunicipioEmissor: alvara.cliMunicipioEmissor ?? null } as any),
            } as any,
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

          await updateAlvara(alvara.id, validacaoParaCampos(validacao));

          // ResultadoValidacaoCompleto tem: situacao, endereco, cnae
          const res = validacao.endereco.resultado;
          log.push({ alvaraId: alvara.id, status: "ok", resultado: res });
        } catch (e: any) {
          log.push({ alvaraId: alvara.id, status: "erro", resultado: e?.message ?? "Erro desconhecido" });
        }
      }

      const resumo = {
        total: alvos.length,
        ok: log.filter(l => l.status === "ok").length,
        erros: log.filter(l => l.status === "erro").length,
        semCliente: log.filter(l => l.status === "sem_cliente").length,
      };

      return { resumo, log };
    }),
});
