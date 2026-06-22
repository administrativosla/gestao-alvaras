import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  addHistorico,
  createAlvara,
  createCliente,
  createImportacao,
  getClienteByCnpj,
  updateImportacao,
} from "../db";
import * as XLSX from "xlsx";
import { invokeLLM } from "../_core/llm";
import { parseDate } from "../utils/parseDate";

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
                status: (() => { const _h=new Date();_h.setHours(0,0,0,0);const _v=new Date(dataVencimento);_v.setHours(0,0,0,0);return Math.ceil((_v.getTime()-_h.getTime())/86400000)>30?"Em Vigência":"Pendente"; })(),
              });
              const _statusXlsx = (() => { const _h=new Date();_h.setHours(0,0,0,0);const _v=new Date(dataVencimento);_v.setHours(0,0,0,0);return Math.ceil((_v.getTime()-_h.getTime())/86400000)>30?"Em Vigência":"Pendente"; })();
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
            content: `Você é um assistente especializado em extrair dados de alvarás de funcionamento brasileiros.
Extraia os seguintes campos do documento PDF fornecido e retorne APENAS um JSON válido, sem markdown, sem explicações.
Campos a extrair:
- cnpj: string (formato XX.XXX.XXX/XXXX-XX)
- razaoSocial: string
- nomeFantasia: string ou null
- inscricaoEstadual: string ou null
- inscricaoMunicipal: string ou null
- logradouro: string ou null
- numero: string ou null
- bairro: string ou null
- cidade: string ou null
- uf: string (2 letras) ou null
- cep: string ou null
- numeroAlvara: string ou null
- tipo: string (ex: "Funcionamento", "Sanitário", "Bombeiros") ou null
- orgaoEmissor: string ou null
- dataEmissao: string (formato YYYY-MM-DD) ou null
- dataVencimento: string (formato YYYY-MM-DD) ou null
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
                text: "Extraia os dados deste alvará e retorne apenas o JSON.",
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
          alvaraId = await createAlvara({
            clienteId,
            numeroAlvara: dados.numeroAlvara ?? null,
            tipo: dados.tipo ?? "Funcionamento",
            orgaoEmissor: dados.orgaoEmissor ?? null,
            dataEmissao: parseDate(dados.dataEmissao),
            dataVencimento,
            arquivoPdfKey: dados.arquivoPdfKey ?? null,
            arquivoPdfUrl: dados.arquivoPdfUrl ?? null,
            status: (() => { const _h=new Date();_h.setHours(0,0,0,0);const _v=new Date(dataVencimento);_v.setHours(0,0,0,0);return Math.ceil((_v.getTime()-_h.getTime())/86400000)>30?"Em Vigência":"Pendente"; })(),
          });
          const _statusPdf = (() => { const _h=new Date();_h.setHours(0,0,0,0);const _v=new Date(dataVencimento);_v.setHours(0,0,0,0);return Math.ceil((_v.getTime()-_h.getTime())/86400000)>30?"Em Vigência":"Pendente"; })();
          await addHistorico({
            alvaraId,
            statusAnterior: null,
            statusNovo: _statusPdf,
            observacao: `Importado via PDF: ${input.fileName}${_statusPdf==="Em Vigência"?`. Em vigência até ${dataVencimento.toLocaleDateString("pt-BR")}.`:". Vencimento próximo."}`,
            colaborador: input.colaborador ?? (ctx as any).user?.name ?? "Sistema",
          });
        }
      }

      return { clienteId, alvaraId, success: true };
    }),
});
