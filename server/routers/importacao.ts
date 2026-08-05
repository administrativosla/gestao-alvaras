import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import JSZip from "jszip";
import {
  addAlvaraPdf,
  addHistorico,
  createAlvara,
  createCliente,
  createImportacao,
  findAlvaraExistente,
  getClienteByCnpj,
  updateAlvara,
  updateCliente,
  updateImportacao,
} from "../db";
import * as XLSX from "xlsx";
import { invokeLLM } from "../_core/llm";
import { parseDate } from "../utils/parseDate";
import { executarValidacao, validacaoParaCampos } from "../validation";
import { getClienteById } from "../db";

// Campos disponíveis para mapeamento
export const CAMPOS_MAPEAMENTO = [
  { key: "cnpj", label: "CNPJ" },
  { key: "razaoSocial", label: "Razão Social" },
  { key: "nomeFantasia", label: "Nome Fantasia" },
  { key: "inscricaoEstadual", label: "Inscrição Estadual" },
  { key: "inscricaoMunicipal", label: "Inscrição Municipal" },
  { key: "logradouro", label: "Logradouro" },
  { key: "numero", label: "Número" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
  { key: "cep", label: "CEP" },
  { key: "nomeContato", label: "Contato" },
  { key: "telefone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "dataAbertura", label: "Data de Abertura" },
  { key: "observacoesPreventivas", label: "Observações" },
  { key: "numeroAlvara", label: "Número do Alvará" },
  { key: "tipo", label: "Tipo de Alvará" },
  { key: "orgaoEmissor", label: "Órgão Emissor" },
  { key: "dataEmissao", label: "Data de Emissão" },
  { key: "dataVencimento", label: "Data de Vencimento" },
] as const;


function formatCnpj(val: unknown): string {
  if (!val) return "";
  return String(val)
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export const importacaoRouter = router({
  getCampos: publicProcedure.query(() => CAMPOS_MAPEAMENTO),

  // Processa XLSX/CSV e retorna colunas + preview de linhas
  parseFile: publicProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        fileType: z.enum(["xlsx", "csv"]),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

      if (rows.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo sem dados suficientes." });
      }

      const headers = (rows[0] as string[]).map((h) => String(h ?? "").trim());
      const preview = rows.slice(1, 6).map((row) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h] = (row as unknown[])[i];
        });
        return obj;
      });

      // Sugestão automática de mapeamento por similaridade de nome
      const sugestoes: Record<string, string> = {};
      const camposMap: Record<string, string> = {
        cnpj: "cnpj",
        "razao social": "razaoSocial",
        "razão social": "razaoSocial",
        "nome fantasia": "nomeFantasia",
        "inscricao estadual": "inscricaoEstadual",
        "inscrição estadual": "inscricaoEstadual",
        ie: "inscricaoEstadual",
        "inscricao municipal": "inscricaoMunicipal",
        "inscrição municipal": "inscricaoMunicipal",
        im: "inscricaoMunicipal",
        logradouro: "logradouro",
        endereco: "logradouro",
        endereço: "logradouro",
        numero: "numero",
        número: "numero",
        bairro: "bairro",
        cidade: "cidade",
        municipio: "cidade",
        município: "cidade",
        uf: "uf",
        estado: "uf",
        cep: "cep",
        contato: "nomeContato",
        responsavel: "nomeContato",
        responsável: "nomeContato",
        telefone: "telefone",
        fone: "telefone",
        email: "email",
        "e-mail": "email",
        "data abertura": "dataAbertura",
        "data de abertura": "dataAbertura",
        observacoes: "observacoesPreventivas",
        observações: "observacoesPreventivas",
        "numero alvara": "numeroAlvara",
        "número alvará": "numeroAlvara",
        "numero do alvara": "numeroAlvara",
        alvara: "numeroAlvara",
        alvará: "numeroAlvara",
        tipo: "tipo",
        "tipo alvara": "tipo",
        "tipo de alvara": "tipo",
        orgao: "orgaoEmissor",
        órgão: "orgaoEmissor",
        "orgao emissor": "orgaoEmissor",
        "órgão emissor": "orgaoEmissor",
        "data emissao": "dataEmissao",
        "data de emissao": "dataEmissao",
        "data emissão": "dataEmissao",
        emissao: "dataEmissao",
        "data vencimento": "dataVencimento",
        "data de vencimento": "dataVencimento",
        vencimento: "dataVencimento",
        validade: "dataVencimento",
      };

      headers.forEach((h) => {
        const lower = h.toLowerCase().trim();
        if (camposMap[lower]) {
          sugestoes[h] = camposMap[lower];
        }
      });

      return { headers, preview, sugestoes, totalLinhas: rows.length - 1 };
    }),

  // Confirma importação com mapeamento definido
  confirmarImportacao: publicProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        fileName: z.string(),
        fileType: z.enum(["xlsx", "csv"]),
        mapeamento: z.record(z.string(), z.string()), // { coluna_arquivo: campo_sistema }
        colaborador: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

      const headers = (rows[0] as string[]).map((h) => String(h ?? "").trim());
      const dataRows = rows.slice(1);

      const importacaoId = await createImportacao({
        nomeArquivo: input.fileName,
        tipoArquivo: input.fileType,
        totalRegistros: dataRows.length,
        status: "processando",
        realizadoPor: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
      });

      let importados = 0;
      let erros = 0;
      const errosList: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        const rowData: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          const campo = (input.mapeamento as Record<string, string>)[h];
          if (campo) rowData[campo] = row[idx];
        });

        try {
          const cnpj = formatCnpj(rowData.cnpj);
          if (!cnpj || !rowData.razaoSocial) {
            erros++;
            errosList.push(`Linha ${i + 2}: CNPJ ou Razão Social ausente.`);
            continue;
          }

          let clienteId: number;
          const existing = await getClienteByCnpj(cnpj);

          if (existing) {
            clienteId = existing.id;
          } else {
            clienteId = await createCliente({
              cnpj,
              razaoSocial: String(rowData.razaoSocial ?? ""),
              nomeFantasia: rowData.nomeFantasia ? String(rowData.nomeFantasia) : null,
              inscricaoEstadual: rowData.inscricaoEstadual
                ? String(rowData.inscricaoEstadual)
                : null,
              inscricaoMunicipal: rowData.inscricaoMunicipal
                ? String(rowData.inscricaoMunicipal)
                : null,
              logradouro: rowData.logradouro ? String(rowData.logradouro) : null,
              numero: rowData.numero ? String(rowData.numero) : null,
              bairro: rowData.bairro ? String(rowData.bairro) : null,
              cidade: rowData.cidade ? String(rowData.cidade) : null,
              uf: rowData.uf ? String(rowData.uf) : null,
              cep: rowData.cep ? String(rowData.cep) : null,
              nomeContato: rowData.nomeContato ? String(rowData.nomeContato) : null,
              telefone: rowData.telefone ? String(rowData.telefone) : null,
              email: rowData.email ? String(rowData.email) : null,
              dataAbertura: parseDate(rowData.dataAbertura),
              observacoesPreventivas: rowData.observacoesPreventivas
                ? String(rowData.observacoesPreventivas)
                : null,
            });
          }

          // Cria alvará se tiver data de vencimento
          if (rowData.dataVencimento) {
            const dataVencimento = parseDate(rowData.dataVencimento);
            if (dataVencimento) {
              const alvaraId = await createAlvara({
                clienteId,
                numeroAlvara: rowData.numeroAlvara ? String(rowData.numeroAlvara) : null,
                tipo: rowData.tipo ? String(rowData.tipo) : "Funcionamento",
                orgaoEmissor: rowData.orgaoEmissor ? String(rowData.orgaoEmissor) : null,
                dataEmissao: parseDate(rowData.dataEmissao),
                dataVencimento,
                status: (() => { const _h=new Date();_h.setHours(0,0,0,0);const _v=new Date(dataVencimento);_v.setHours(0,0,0,0);return Math.ceil((_v.getTime()-_h.getTime())/86400000)>30?"Em Vigência":"Vencido"; })(),
              });
              const _statusXlsx = (() => { const _h=new Date();_h.setHours(0,0,0,0);const _v=new Date(dataVencimento);_v.setHours(0,0,0,0);return Math.ceil((_v.getTime()-_h.getTime())/86400000)>30?"Em Vigência":"Vencido"; })();
              await addHistorico({
                alvaraId,
                statusAnterior: null,
                statusNovo: _statusXlsx,
                observacao: `Importado via arquivo ${input.fileName}${_statusXlsx==="Em Vigência"?`. Em vigência até ${dataVencimento.toLocaleDateString("pt-BR")}.`:". Vencimento próximo."}`,
                colaborador: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
              });
            }
          }

          importados++;
        } catch (e: any) {
          erros++;
          errosList.push(`Linha ${i + 2}: ${e.message ?? "Erro desconhecido"}`);
        }
      }

      await updateImportacao(importacaoId, {
        registrosImportados: importados,
        registrosErro: erros,
        status: "concluido",
        erros: errosList.length > 0 ? errosList.join("\n") : null,
      });

      return { importados, erros, errosList, importacaoId };
    }),

  // Extrai dados de PDF via LLM
  parsePdf: publicProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
        const fileUrl: string = `data:application/pdf;base64,${input.fileBase64}`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um assistente especializado em extrair dados de documentos de licenciamento empresarial brasileiros, incluindo alvarás de funcionamento municipais e o CLI (Certificado de Licenciamento Integrado) do Estado de São Paulo.

REGRAS FUNDAMENTAIS:
1. Para identificar se é um CLI de SP: procure a seção "DADOS DA SOLICITAÇÃO" na primeira página, que contém os campos "PROTOCOLO/NÚMERO" (começa com SPM), "DATA DA SOLICITAÇÃO" e "DATA DE VALIDADE".
2. Para o CLI de SP: o campo dataVencimento DEVE ser preenchido com a "DATA DE VALIDADE" da seção "DADOS DA SOLICITAÇÃO" na primeira página. Esta é a data mais importante do documento. Nunca deixe dataVencimento como null se essa data estiver visível.
3. Para alvarás comuns: dataVencimento é a data de validade/vencimento do documento.
4. Todas as datas devem ser retornadas no formato YYYY-MM-DD.

Campos a extrair:
- cnpj: string (formato XX.XXX.XXX/XXXX-XX)
- razaoSocial: string
- nomeFantasia: string ou null
- inscricaoEstadual: string ou null
- inscricaoMunicipal: string ou null (no CLI aparece como "INSCRIÇÃO MUNICIPAL")
- logradouro: string ou null
- numero: string ou null
- bairro: string ou null
- cidade: string ou null
- uf: string (2 letras) ou null
- cep: string ou null
- numeroAlvara: string ou null (no CLI use o valor do campo "PROTOCOLO/NÚMERO", ex: SPM2430532320)
- tipo: para CLI retorne exatamente "CLI", para outros retorne o tipo (ex: "Funcionamento", "Sanitário", "Bombeiros")
- orgaoEmissor: string ou null (no CLI retorne "Prefeitura de [cidade] / VRE-SP")
- dataEmissao: string (formato YYYY-MM-DD) ou null (no CLI use "DATA DA SOLICITAÇÃO")
- dataVencimento: string (formato YYYY-MM-DD) ou null — CAMPO CRÍTICO: no CLI use obrigatoriamente a "DATA DE VALIDADE" da seção "DADOS DA SOLICITAÇÃO"
- situacaoCli: para documentos CLI, retorne "parcial" se o documento contiver qualquer uma das expressões: "documento parcial", "pendente de finalização", "não produz os efeitos legais", "PENDENTE DE FINALIZAÇÃO" (tarja d'água), "finalizar as licenças dos órgãos integrados". Caso contrário, retorne "completo". Para documentos que não são CLI, retorne null.
- cliOrgaosPendentes: SOMENTE para CLI com situacaoCli="parcial". Array de objetos com os órgãos integrados que ainda estão PENDENTES de emitir manifestação definitiva. Para cada órgão listado no documento que ainda não possui manifestação definitiva (ex: aparece como "Protocolo", "Indeterminado", sem número de documento final, ou com anotação de pendência), inclua: {"orgao": "nome do órgão", "tipoManifestacao": "tipo esperado (AVCB/CLCB/Licença/Protocolo/etc)", "status": "pendente"}. Para CLIs completos ou não-CLI, retorne null.
- cliCnaesLicenciados: SOMENTE para documentos CLI. Array de strings com os códigos CNAE licenciados listados no documento. Procure em DUAS seções do documento: (1) seção "ATIVIDADES ECONÔMICAS LICENCIADAS" que lista no formato "6203100 - Descrição"; (2) seção "PARECER DA PREFEITURA" que lista no formato "CNAE: 6203-1/00-Descrição". Extraia apenas o código numérico sem formatação (ex: "62031", "62023", "62040"). Use a seção com mais entradas. Para documentos que não são CLI, retorne null.
Se não encontrar um campo, use null.`,
          },
          {
            role: "user",
              content: [
              {
                type: "file_url" as const,
                file_url: {
                  url: fileUrl,
                  mime_type: "application/pdf" as const,
                },
              },
              {
                type: "text" as const,
                text: "Extraia os dados deste documento de licenciamento e retorne apenas o JSON. Atenção especial: se for um CLI de SP, a DATA DE VALIDADE da seção DADOS DA SOLICITAÇÃO deve ser o dataVencimento. Verifique se o documento contém a tarja PENDENTE DE FINALIZAÇÃO ou expressões como 'documento parcial' e 'não produz os efeitos legais' para definir situacaoCli. Se for CLI parcial, identifique quais órgãos integrados ainda estão pendentes de manifestação definitiva para cliOrgaosPendentes.",
              },
            ] as any,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "alvara_data",
            strict: true,
            schema: {
              type: "object",
              properties: {
                cnpj: { type: "string" },
                razaoSocial: { type: "string" },
                nomeFantasia: { type: ["string", "null"] },
                inscricaoEstadual: { type: ["string", "null"] },
                inscricaoMunicipal: { type: ["string", "null"] },
                logradouro: { type: ["string", "null"] },
                numero: { type: ["string", "null"] },
                bairro: { type: ["string", "null"] },
                cidade: { type: ["string", "null"] },
                uf: { type: ["string", "null"] },
                cep: { type: ["string", "null"] },
                numeroAlvara: { type: ["string", "null"] },
                tipo: { type: ["string", "null"] },
                orgaoEmissor: { type: ["string", "null"] },
                dataEmissao: { type: ["string", "null"] },
                dataVencimento: { type: ["string", "null"] },
                situacaoCli: { type: ["string", "null"] },
                cliOrgaosPendentes: {
                  type: ["array", "null"],
                  items: {
                    type: "object",
                    properties: {
                      orgao: { type: "string" },
                      tipoManifestacao: { type: "string" },
                      status: { type: "string" },
                    },
                    required: ["orgao", "tipoManifestacao", "status"],
                    additionalProperties: false,
                  },
                },
                cliCnaesLicenciados: {
                  type: ["array", "null"],
                  items: { type: "string" },
                },
              },
              required: [
                "cnpj",
                "razaoSocial",
                "nomeFantasia",
                "inscricaoEstadual",
                "inscricaoMunicipal",
                "logradouro",
                "numero",
                "bairro",
                "cidade",
                "uf",
                "cep",
                "numeroAlvara",
                "tipo",
                "orgaoEmissor",
                "dataEmissao",
                "dataVencimento",
                "situacaoCli",
                "cliOrgaosPendentes",
                "cliCnaesLicenciados",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha na extração." });

      let dados: Record<string, unknown>;
      try {
        dados = typeof content === "string" ? JSON.parse(content) : content;
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resposta inválida do extrator." });
      }

      return dados;
    }),

  // Confirma importação de PDF após revisão
  confirmarPdf: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        dados: z.object({
          cnpj: z.string(),
          razaoSocial: z.string(),
          nomeFantasia: z.string().optional().nullable(),
          inscricaoEstadual: z.string().optional().nullable(),
          inscricaoMunicipal: z.string().optional().nullable(),
          logradouro: z.string().optional().nullable(),
          numero: z.string().optional().nullable(),
          bairro: z.string().optional().nullable(),
          cidade: z.string().optional().nullable(),
          uf: z.string().optional().nullable(),
          cep: z.string().optional().nullable(),
          numeroAlvara: z.string().optional().nullable(),
          tipo: z.string().optional().nullable(),
          orgaoEmissor: z.string().optional().nullable(),
          dataEmissao: z.string().optional().nullable(),
          dataVencimento: z.string().optional().nullable(),
          arquivoPdfKey: z.string().optional().nullable(),
          arquivoPdfUrl: z.string().optional().nullable(),
          situacaoCli: z.string().optional().nullable(),
          cliNumeroSolicitacao: z.string().optional().nullable(),
          cliOrgaosPendentes: z.array(z.object({
            orgao: z.string(),
            tipoManifestacao: z.string(),
            status: z.string(),
            resolvidoEm: z.string().optional().nullable(),
            resolvidoPor: z.string().optional().nullable(),
            observacao: z.string().optional().nullable(),
          })).optional().nullable(),
          cliCnaesLicenciados: z.array(z.string()).optional().nullable(),
        }),
        colaborador: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { dados } = input;
      const cnpj = formatCnpj(dados.cnpj) || dados.cnpj;

      let clienteId: number;
      const existing = await getClienteByCnpj(cnpj);

      if (existing) {
        clienteId = existing.id;
      } else {
        clienteId = await createCliente({
          cnpj,
          razaoSocial: dados.razaoSocial,
          nomeFantasia: dados.nomeFantasia ?? null,
          inscricaoEstadual: dados.inscricaoEstadual ?? null,
          inscricaoMunicipal: dados.inscricaoMunicipal ?? null,
          logradouro: dados.logradouro ?? null,
          numero: dados.numero ?? null,
          bairro: dados.bairro ?? null,
          cidade: dados.cidade ?? null,
          uf: dados.uf ?? null,
          cep: dados.cep ?? null,
        });
      }

      let alvaraId: number | null = null;
      if (dados.dataVencimento) {
        const dataVencimento = parseDate(dados.dataVencimento);
        if (dataVencimento) {
          const _h = new Date(); _h.setHours(0, 0, 0, 0);
          const _v = new Date(dataVencimento); _v.setHours(0, 0, 0, 0);
          const _dias = Math.ceil((_v.getTime() - _h.getTime()) / 86400000);
          const _statusPdf = _dias > 30 ? "Em Vigência" : "Vencido";
          const _situacaoCli = dados.situacaoCli ?? null;
          const _pendencia = _situacaoCli === "parcial";

          // Verificar se já existe um alvará ativo para este cliente com o mesmo número de solicitação
          const alvaraExistente = await findAlvaraExistente(clienteId, {
            cliNumeroSolicitacao: dados.cliNumeroSolicitacao ?? dados.numeroAlvara ?? null,
            numeroAlvara: dados.numeroAlvara ?? null,
            tipo: dados.tipo ?? null,
          });

          // Serializar pendências por órgão
          const orgaosPendentesJson = dados.cliOrgaosPendentes && dados.cliOrgaosPendentes.length > 0
            ? JSON.stringify(dados.cliOrgaosPendentes)
            : (_pendencia ? null : null); // null para CLIs completos (sem pendências)

          if (alvaraExistente) {
            // UPSERT: atualizar o alvará existente com os novos dados
            alvaraId = alvaraExistente.id;
            const statusAnterior = alvaraExistente.status;
            // Ao re-upload: preservar pendências já resolvidas manualmente
            let orgaosMerged = orgaosPendentesJson;
            if (alvaraExistente.cliOrgaosPendentes && orgaosPendentesJson) {
              try {
                const existentes: any[] = JSON.parse(alvaraExistente.cliOrgaosPendentes);
                const novos: any[] = JSON.parse(orgaosPendentesJson);
                // Manter status "resolvido" para órgãos que já foram resolvidos manualmente
                const merged = novos.map(n => {
                  const prev = existentes.find(e => e.orgao === n.orgao);
                  return prev?.status === "resolvido" ? prev : n;
                });
                orgaosMerged = JSON.stringify(merged);
              } catch { /* manter novo */ }
            }
            await updateAlvara(alvaraExistente.id, {
              dataVencimento,
              dataEmissao: parseDate(dados.dataEmissao) ?? alvaraExistente.dataEmissao ?? undefined,
              arquivoPdfKey: dados.arquivoPdfKey ?? alvaraExistente.arquivoPdfKey ?? null,
              arquivoPdfUrl: dados.arquivoPdfUrl ?? alvaraExistente.arquivoPdfUrl ?? null,
              situacaoCli: _situacaoCli,
              pendenciaRegularizacao: _pendencia,
              motivoPendenciaCli: _pendencia ? "Detectado automaticamente: CLI parcial pendente de finalização" : null,
              cliOrgaosPendentes: orgaosMerged,
              cliCnaesLicenciados: dados.cliCnaesLicenciados && dados.cliCnaesLicenciados.length > 0
                ? JSON.stringify(dados.cliCnaesLicenciados)
                : null,
              status: _statusPdf,
            });
            await addHistorico({
              alvaraId: alvaraExistente.id,
              statusAnterior,
              statusNovo: _statusPdf,
              observacao: `Atualizado via re-upload de PDF: ${input.fileName}. Situação CLI: ${_situacaoCli ?? "não informada"}.${_statusPdf === "Em Vigência" ? ` Em vigência até ${dataVencimento.toLocaleDateString("pt-BR")}.` : " Vencimento próximo."}`,
              colaborador: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
            });
            // Registrar no histórico de PDFs
            if (dados.arquivoPdfKey && dados.arquivoPdfUrl) {
              await addAlvaraPdf({
                alvaraId: alvaraExistente.id,
                fileName: input.fileName,
                pdfKey: dados.arquivoPdfKey,
                pdfUrl: dados.arquivoPdfUrl,
                uploadedBy: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
              }).catch(() => {/* não bloquear */});
            }
          } else {
            // INSERT: criar novo alvará
            alvaraId = await createAlvara({
              clienteId,
              numeroAlvara: dados.numeroAlvara ?? null,
              tipo: dados.tipo ?? "Funcionamento",
              orgaoEmissor: dados.orgaoEmissor ?? null,
              dataEmissao: parseDate(dados.dataEmissao),
              dataVencimento,
              arquivoPdfKey: dados.arquivoPdfKey ?? null,
              arquivoPdfUrl: dados.arquivoPdfUrl ?? null,
              situacaoCli: _situacaoCli,
              pendenciaRegularizacao: _pendencia,
              motivoPendenciaCli: _pendencia ? "Detectado automaticamente: CLI parcial pendente de finalização" : null,
              cliOrgaosPendentes: orgaosPendentesJson,
              cliCnaesLicenciados: dados.cliCnaesLicenciados && dados.cliCnaesLicenciados.length > 0
                ? JSON.stringify(dados.cliCnaesLicenciados)
                : null,
              status: _statusPdf,
            });
            await addHistorico({
              alvaraId,
              statusAnterior: null,
              statusNovo: _statusPdf,
              observacao: `Importado via PDF: ${input.fileName}${_statusPdf === "Em Vigência" ? `. Em vigência até ${dataVencimento.toLocaleDateString("pt-BR")}.` : ". Vencimento próximo."}`,
              colaborador: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
            });
            // Registrar no histórico de PDFs
            if (dados.arquivoPdfKey && dados.arquivoPdfUrl) {
              await addAlvaraPdf({
                alvaraId,
                fileName: input.fileName,
                pdfKey: dados.arquivoPdfKey,
                pdfUrl: dados.arquivoPdfUrl,
                uploadedBy: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
              }).catch(() => {/* não bloquear */});
            }
          }
        }
      }

      // ── Executar validação após salvar o alvará ─────────────────────────────────────────────────────────────────────────────────
      if (alvaraId) {
        try {
          const clienteData = await getClienteById(clienteId);
          if (clienteData) {
            const validacao = executarValidacao(
              {
                logradouro: dados.logradouro,
                numero: dados.numero,
                bairro: dados.bairro,
                cidade: dados.cidade,
                uf: dados.uf,
                cep: dados.cep,
                tipo: dados.tipo,
                orgaoEmissor: dados.orgaoEmissor,
                cliCnaesLicenciados: dados.cliCnaesLicenciados ?? null,
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
            await updateAlvara(alvaraId, validacaoParaCampos(validacao));
          }
        } catch (e) {
          // Validação não bloqueia a importação — falha silenciosa com log
          console.error("[Validação] Erro ao validar alvará", alvaraId, e);
        }
      }

      // ── Desativar semRegistro ao importar alvara/CLI ────────────────────────────────
      try {
        await updateCliente(clienteId, { semRegistro: false });
      } catch (e) {
        console.error("[Importação] Erro ao desativar semRegistro", clienteId, e);
      }

      return { clienteId, alvaraId, success: true };
    }),

  // ── Extrai dados de múltiplos PDFs via LLM (processamento paralelo) ────────────────────────
  parsePdfLote: publicProcedure
    .input(
      z.object({
        arquivos: z.array(
          z.object({
            fileName: z.string(),
            fileBase64: z.string(),
          })
        ).min(1).max(50),
      })
    )
    .mutation(async ({ input }) => {
      const resultados = await Promise.allSettled(
        input.arquivos.map(async (arq) => {
          const fileUrl = `data:application/pdf;base64,${arq.fileBase64}`;
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `Você é um assistente especializado em extrair dados de documentos de licenciamento empresarial brasileiros, incluindo alvarás de funcionamento municipais e o CLI (Certificado de Licenciamento Integrado) do Estado de São Paulo.

REGRAS FUNDAMENTAIS:
1. Para identificar se é um CLI de SP: procure a seção "DADOS DA SOLICITAÇÃO" na primeira página, que contém os campos "PROTOCOLO/NÚMERO" (começa com SPM), "DATA DA SOLICITAÇÃO" e "DATA DE VALIDADE".
2. Para o CLI de SP: o campo dataVencimento DEVE ser preenchido com a "DATA DE VALIDADE" da seção "DADOS DA SOLICITAÇÃO" na primeira página. Esta é a data mais importante do documento. Nunca deixe dataVencimento como null se essa data estiver visível.
3. Para alvarás comuns: dataVencimento é a data de validade/vencimento do documento.
4. Todas as datas devem ser retornadas no formato YYYY-MM-DD.

Campos a extrair:
- cnpj: string (formato XX.XXX.XXX/XXXX-XX)
- razaoSocial: string
- nomeFantasia: string ou null
- inscricaoEstadual: string ou null
- inscricaoMunicipal: string ou null (no CLI aparece como "INSCRIÇÃO MUNICIPAL")
- logradouro: string ou null
- numero: string ou null
- bairro: string ou null
- cidade: string ou null
- uf: string (2 letras) ou null
- cep: string ou null
- numeroAlvara: string ou null (no CLI use o valor do campo "PROTOCOLO/NÚMERO", ex: SPM2430532320)
- tipo: para CLI retorne exatamente "CLI", para outros retorne o tipo (ex: "Funcionamento", "Sanitário", "Bombeiros")
- orgaoEmissor: string ou null (no CLI retorne "Prefeitura de [cidade] / VRE-SP")
- dataEmissao: string (formato YYYY-MM-DD) ou null (no CLI use "DATA DA SOLICITAÇÃO")
- dataVencimento: string (formato YYYY-MM-DD) ou null — CAMPO CRÍTICO: no CLI use obrigatoriamente a "DATA DE VALIDADE" da seção "DADOS DA SOLICITAÇÃO"
- situacaoCli: para documentos CLI, retorne "parcial" se o documento contiver qualquer uma das expressões: "documento parcial", "pendente de finalização", "não produz os efeitos legais", "PENDENTE DE FINALIZAÇÃO" (tarja d'água), "finalizar as licenças dos órgãos integrados". Caso contrário, retorne "completo". Para documentos que não são CLI, retorne null.
- cliOrgaosPendentes: SOMENTE para CLI com situacaoCli="parcial". Array de objetos com os órgãos integrados que ainda estão PENDENTES de emitir manifestação definitiva. Para cada órgão listado no documento que ainda não possui manifestação definitiva (ex: aparece como "Protocolo", "Indeterminado", sem número de documento final, ou com anotação de pendência), inclua: {"orgao": "nome do órgão", "tipoManifestacao": "tipo esperado (AVCB/CLCB/Licença/Protocolo/etc)", "status": "pendente"}. Para CLIs completos ou não-CLI, retorne null.
- cliCnaesLicenciados: SOMENTE para documentos CLI. Array de strings com os códigos CNAE licenciados listados no documento. Procure em DUAS seções do documento: (1) seção "ATIVIDADES ECONÔMICAS LICENCIADAS" que lista no formato "6203100 - Descrição"; (2) seção "PARECER DA PREFEITURA" que lista no formato "CNAE: 6203-1/00-Descrição". Extraia apenas o código numérico sem formatação (ex: "62031", "62023", "62040"). Use a seção com mais entradas. Para documentos que não são CLI, retorne null.
Se não encontrar um campo, use null.`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "file_url" as const,
                    file_url: { url: fileUrl, mime_type: "application/pdf" as const },
                  },
                  { type: "text" as const, text: "Extraia os dados deste documento de licenciamento e retorne apenas o JSON. Atenção especial: se for um CLI de SP, a DATA DE VALIDADE da seção DADOS DA SOLICITAÇÃO deve ser o dataVencimento. Verifique se o documento contém a tarja PENDENTE DE FINALIZAÇÃO ou expressões como 'documento parcial' e 'não produz os efeitos legais' para definir situacaoCli. Se for CLI parcial, identifique quais órgãos integrados ainda estão pendentes de manifestação definitiva para cliOrgaosPendentes." },
                ] as any,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "alvara_data",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    cnpj: { type: "string" },
                    razaoSocial: { type: "string" },
                    nomeFantasia: { type: ["string", "null"] },
                    inscricaoEstadual: { type: ["string", "null"] },
                    inscricaoMunicipal: { type: ["string", "null"] },
                    logradouro: { type: ["string", "null"] },
                    numero: { type: ["string", "null"] },
                    bairro: { type: ["string", "null"] },
                    cidade: { type: ["string", "null"] },
                    uf: { type: ["string", "null"] },
                    cep: { type: ["string", "null"] },
                    numeroAlvara: { type: ["string", "null"] },
                    tipo: { type: ["string", "null"] },
                    orgaoEmissor: { type: ["string", "null"] },
                    dataEmissao: { type: ["string", "null"] },
                    dataVencimento: { type: ["string", "null"] },
                    situacaoCli: { type: ["string", "null"] },
                cliOrgaosPendentes: {
                  type: ["array", "null"],
                  items: {
                    type: "object",
                    properties: {
                      orgao: { type: "string" },
                      tipoManifestacao: { type: "string" },
                      status: { type: "string" },
                    },
                    required: ["orgao", "tipoManifestacao", "status"],
                    additionalProperties: false,
                  },
                },
                cliCnaesLicenciados: {
                  type: ["array", "null"],
                  items: { type: "string" },
                },
              },
              required: ["cnpj","razaoSocial","nomeFantasia","inscricaoEstadual","inscricaoMunicipal","logradouro","numero","bairro","cidade","uf","cep","numeroAlvara","tipo","orgaoEmissor","dataEmissao","dataVencimento","situacaoCli","cliOrgaosPendentes","cliCnaesLicenciados"],
              additionalProperties: false,
                },
              },
            },
          });
          const content = response.choices[0]?.message?.content;
          if (!content) throw new Error("Sem resposta do extrator");
          const dados = typeof content === "string" ? JSON.parse(content) : content;
          return { fileName: arq.fileName, dados, erro: null };
        })
      );

      return resultados.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        return {
          fileName: input.arquivos[i].fileName,
          dados: null,
          erro: r.reason?.message ?? "Erro desconhecido",
        };
      });
    }),

  // ── Descompacta ZIP e extrai PDFs internos ───────────────────────────────────
  parseZip: publicProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const zip = await JSZip.loadAsync(buffer);

      const pdfFiles: { fileName: string; fileBase64: string }[] = [];
      const erros: string[] = [];

      await Promise.all(
        Object.entries(zip.files).map(async ([name, file]) => {
          if (file.dir) return;
          const ext = name.split(".").pop()?.toLowerCase();
          if (ext !== "pdf") {
            erros.push(`${name}: formato não suportado (apenas PDFs são processados dentro do ZIP)`);
            return;
          }
          if (name.includes("/") && name.split("/")[0] === "__MACOSX") return; // ignorar metadados macOS
          const data = await file.async("base64");
          pdfFiles.push({ fileName: name.split("/").pop() ?? name, fileBase64: data });
        })
      );

      if (pdfFiles.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum PDF encontrado dentro do arquivo ZIP." });
      }

      return { arquivos: pdfFiles, totalEncontrados: pdfFiles.length, erros };
    }),

  // ── Confirma importação em lote após revisão ─────────────────────────────────
  confirmarLote: publicProcedure
    .input(
      z.object({
        registros: z.array(
          z.object({
            fileName: z.string(),
            cnpj: z.string(),
            razaoSocial: z.string(),
            nomeFantasia: z.string().optional().nullable(),
            inscricaoEstadual: z.string().optional().nullable(),
            inscricaoMunicipal: z.string().optional().nullable(),
            logradouro: z.string().optional().nullable(),
            numero: z.string().optional().nullable(),
            bairro: z.string().optional().nullable(),
            cidade: z.string().optional().nullable(),
            uf: z.string().optional().nullable(),
            cep: z.string().optional().nullable(),
            numeroAlvara: z.string().optional().nullable(),
            tipo: z.string().optional().nullable(),
            orgaoEmissor: z.string().optional().nullable(),
            dataEmissao: z.string().optional().nullable(),
            dataVencimento: z.string().optional().nullable(),
            situacaoCli: z.string().optional().nullable(),
            cliNumeroSolicitacao: z.string().optional().nullable(),
            cliOrgaosPendentes: z.array(z.object({
              orgao: z.string(),
              tipoManifestacao: z.string(),
              status: z.string(),
              resolvidoEm: z.string().optional().nullable(),
              resolvidoPor: z.string().optional().nullable(),
              observacao: z.string().optional().nullable(),
            })).optional().nullable(),
            cliCnaesLicenciados: z.array(z.string()).optional().nullable(),
            arquivoPdfKey: z.string().optional().nullable(),
            arquivoPdfUrl: z.string().optional().nullable(),
          })
        ).min(1),
        colaborador: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let importados = 0;
      let atualizados = 0;
      const errosList: string[] = [];

      for (const reg of input.registros) {
        try {
          const cnpj = formatCnpj(reg.cnpj) || reg.cnpj;
          if (!cnpj || !reg.razaoSocial) {
            errosList.push(`${reg.fileName}: CNPJ ou Razão Social ausente.`);
            continue;
          }

          let clienteId: number;
          const existing = await getClienteByCnpj(cnpj);

          if (existing) {
            clienteId = existing.id;
            atualizados++;
          } else {
            clienteId = await createCliente({
              cnpj,
              razaoSocial: reg.razaoSocial,
              nomeFantasia: reg.nomeFantasia ?? null,
              inscricaoEstadual: reg.inscricaoEstadual ?? null,
              inscricaoMunicipal: reg.inscricaoMunicipal ?? null,
              logradouro: reg.logradouro ?? null,
              numero: reg.numero ?? null,
              bairro: reg.bairro ?? null,
              cidade: reg.cidade ?? null,
              uf: reg.uf ?? null,
              cep: reg.cep ?? null,
            });
          }

          if (reg.dataVencimento) {
            const dataVencimento = parseDate(reg.dataVencimento);
            if (dataVencimento) {
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const venc = new Date(dataVencimento);
              venc.setHours(0, 0, 0, 0);
              const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
              const status = diasRestantes > 30 ? "Em Vigência" : "Vencido";

              const _situacaoCliLote = reg.situacaoCli ?? null;
              const _pendenciaLote = _situacaoCliLote === "parcial";

              // Serializar pendências por órgão
              const orgaosPendentesJsonLote = reg.cliOrgaosPendentes && reg.cliOrgaosPendentes.length > 0
                ? JSON.stringify(reg.cliOrgaosPendentes)
                : null;

              // Verificar se já existe alvará ativo para este cliente (upsert)
              const alvaraExistenteLote = await findAlvaraExistente(clienteId, {
                cliNumeroSolicitacao: reg.cliNumeroSolicitacao ?? reg.numeroAlvara ?? null,
                numeroAlvara: reg.numeroAlvara ?? null,
                tipo: reg.tipo ?? null,
              });

              // Variável para guardar o ID do alvará criado/atualizado
              let alvaraIdLote: number | null = null;

              if (alvaraExistenteLote) {
                // Atualizar alvará existente — preservar pendências já resolvidas manualmente
                const statusAnteriorLote = alvaraExistenteLote.status;
                let orgaosMergedLote = orgaosPendentesJsonLote;
                if (alvaraExistenteLote.cliOrgaosPendentes && orgaosPendentesJsonLote) {
                  try {
                    const existentesL: any[] = JSON.parse(alvaraExistenteLote.cliOrgaosPendentes);
                    const novosL: any[] = JSON.parse(orgaosPendentesJsonLote);
                    const mergedL = novosL.map((n: any) => {
                      const prev = existentesL.find((e: any) => e.orgao === n.orgao);
                      return prev?.status === "resolvido" ? prev : n;
                    });
                    orgaosMergedLote = JSON.stringify(mergedL);
                  } catch { /* manter novo */ }
                }
                await updateAlvara(alvaraExistenteLote.id, {
                  dataVencimento,
                  dataEmissao: parseDate(reg.dataEmissao) ?? alvaraExistenteLote.dataEmissao ?? undefined,
                  situacaoCli: _situacaoCliLote,
                  pendenciaRegularizacao: _pendenciaLote,
                  motivoPendenciaCli: _pendenciaLote ? "Detectado automaticamente: CLI parcial pendente de finalização" : null,
                  cliOrgaosPendentes: orgaosMergedLote,
                  cliCnaesLicenciados: reg.cliCnaesLicenciados && reg.cliCnaesLicenciados.length > 0
                    ? JSON.stringify(reg.cliCnaesLicenciados)
                    : null,
                  status,
                  ...(reg.arquivoPdfKey ? { arquivoPdfKey: reg.arquivoPdfKey } : {}),
                  ...(reg.arquivoPdfUrl ? { arquivoPdfUrl: reg.arquivoPdfUrl } : {}),
                });
                await addHistorico({
                  alvaraId: alvaraExistenteLote.id,
                  statusAnterior: statusAnteriorLote,
                  statusNovo: status,
                  observacao: `Atualizado via re-upload em lote: ${reg.fileName}. Situação CLI: ${_situacaoCliLote ?? "não informada"}.${status === "Em Vigência" ? ` Em vigência até ${dataVencimento.toLocaleDateString("pt-BR")}.` : " Vencimento próximo."}`,
                  colaborador: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
                });
                if (reg.arquivoPdfKey && reg.arquivoPdfUrl) {
                  await addAlvaraPdf({
                    alvaraId: alvaraExistenteLote.id,
                    fileName: reg.fileName,
                    pdfKey: reg.arquivoPdfKey,
                    pdfUrl: reg.arquivoPdfUrl,
                    uploadedBy: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
                  }).catch(() => {});
                }
                alvaraIdLote = alvaraExistenteLote.id;
                atualizados++;
              } else {
                // Criar novo alvará
                const novoAlvaraId = await createAlvara({
                  clienteId,
                  numeroAlvara: reg.numeroAlvara ?? null,
                  tipo: reg.tipo ?? "Funcionamento",
                  orgaoEmissor: reg.orgaoEmissor ?? null,
                  dataEmissao: parseDate(reg.dataEmissao),
                  dataVencimento,
                  situacaoCli: _situacaoCliLote,
                  pendenciaRegularizacao: _pendenciaLote,
                  motivoPendenciaCli: _pendenciaLote ? "Detectado automaticamente: CLI parcial pendente de finalização" : null,
                  cliOrgaosPendentes: orgaosPendentesJsonLote,
                  cliCnaesLicenciados: reg.cliCnaesLicenciados && reg.cliCnaesLicenciados.length > 0
                    ? JSON.stringify(reg.cliCnaesLicenciados)
                    : null,
                  status,
                  arquivoPdfKey: reg.arquivoPdfKey ?? null,
                  arquivoPdfUrl: reg.arquivoPdfUrl ?? null,
                });
                await addHistorico({
                  alvaraId: novoAlvaraId,
                  statusAnterior: null,
                  statusNovo: status,
                  observacao: `Importado em lote via PDF: ${reg.fileName}${status === "Em Vigência" ? `. Em vigência até ${dataVencimento.toLocaleDateString("pt-BR")}.` : ". Vencimento próximo."}`,
                  colaborador: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
                });
                if (reg.arquivoPdfKey && reg.arquivoPdfUrl) {
                  await addAlvaraPdf({
                    alvaraId: novoAlvaraId,
                    fileName: reg.fileName,
                    pdfKey: reg.arquivoPdfKey,
                    pdfUrl: reg.arquivoPdfUrl,
                    uploadedBy: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
                  }).catch(() => {});
                }
                alvaraIdLote = novoAlvaraId;
                importados++;
              }

              // ── Executar validação após salvar o alvará ─────────────────────────────────────────────────────────────────────────────────
              if (alvaraIdLote) {
                try {
                  const clienteDataLote = await getClienteById(clienteId);
                  if (clienteDataLote) {
                    const validacaoLote = executarValidacao(
                      {
                        logradouro: reg.logradouro,
                        numero: reg.numero,
                        bairro: reg.bairro,
                        cidade: reg.cidade,
                        uf: reg.uf,
                        cep: reg.cep,
                        tipo: reg.tipo,
                        orgaoEmissor: reg.orgaoEmissor,
                      },
                      {
                        situacaoCadastral: clienteDataLote.situacaoCadastral,
                        logradouro: clienteDataLote.logradouro,
                        numero: clienteDataLote.numero,
                        bairro: clienteDataLote.bairro,
                        cidade: clienteDataLote.cidade,
                        uf: clienteDataLote.uf,
                        cep: clienteDataLote.cep,
                        cnaePrincipal: clienteDataLote.cnaePrincipal,
                        cnaePrincipalDescricao: clienteDataLote.cnaePrincipalDescricao,
                        cnaesSecundarios: clienteDataLote.cnaesSecundarios,
                      }
                    );
                    await updateAlvara(alvaraIdLote, validacaoParaCampos(validacaoLote));
                  }
                } catch (e) {
                  console.error("[Validação Lote] Erro ao validar alvará", alvaraIdLote, e);
                }
              }

              // Desativar semRegistro ao importar
              try {
                await updateCliente(clienteId, { semRegistro: false });
              } catch (e) {
                console.error("[Importação Lote] Erro ao desativar semRegistro", clienteId, e);
              }
            }
          } else {
            importados++;
          }
        } catch (e: any) {
          errosList.push(`${reg.fileName}: ${e.message ?? "Erro desconhecido"}`);
        }
      }

      return { importados, atualizados, erros: errosList.length, errosList };
    }),
});
