import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router, gestorProcedure, requirePermissao } from "../_core/trpc";
import { parseDate } from "../utils/parseDate";
import {
  CoberturaStatus,
  createCliente,
  deleteCliente,
  getClienteByCnpj,
  getClienteById,
  getEmailsAlerta,
  listClientes,
  listClientesComCobertura,
  listarEstadosClientes,
  listarMunicipiosClientes,
  setEmailsAlerta,
  updateCliente,
} from "../db";
import * as XLSX from "xlsx";

// Normaliza CNPJ para o formato XX.XXX.XXX/XXXX-XX
function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return raw.trim();
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const clienteSchema = z.object({
  cnpj: z.string().min(14).max(18),
  razaoSocial: z.string().min(1).max(255),
  nomeFantasia: z.string().max(255).optional().nullable(),
  inscricaoEstadual: z.string().max(50).optional().nullable(),
  inscricaoMunicipal: z.string().max(50).optional().nullable(),
  logradouro: z.string().max(255).optional().nullable(),
  numero: z.string().max(20).optional().nullable(),
  complemento: z.string().max(100).optional().nullable(),
  bairro: z.string().max(100).optional().nullable(),
  cidade: z.string().max(100).optional().nullable(),
  uf: z.string().max(2).optional().nullable(),
  cep: z.string().max(9).optional().nullable(),
  municipio: z.string().max(100).optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
  nomeContato: z.string().max(255).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
  dataAbertura: z.string().optional().nullable(),
  observacoesPreventivas: z.string().optional().nullable(),
  semRegistro: z.boolean().optional(),
  emailsAlerta: z.array(z.string().email()).optional(),
});

export const clientesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          estado: z.string().optional(),
          municipio: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listClientes(input ?? undefined);
    }),

  listComCobertura: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          estado: z.string().optional(),
          municipio: z.string().optional(),
          cobertura: z.enum(["Sem Registro", "Sem Alvará", "Parcial", "Coberto"]).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listClientesComCobertura(input ?? undefined);
    }),

  listarEstados: protectedProcedure.query(async () => {
    return listarEstadosClientes();
  }),

  listarMunicipios: protectedProcedure
    .input(z.object({ estado: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return listarMunicipiosClientes(input?.estado);
    }),

  importarPlanilha: gestorProcedure
    .input(z.object({ fileBase64: z.string(), fileName: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Planilha vazia ou sem dados." });

      // Mapeamento flexível de colunas (case-insensitive)
      const getCol = (row: Record<string, string>, ...keys: string[]): string => {
        for (const key of keys) {
          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
          const found = Object.keys(row).find((k) => norm(k) === norm(key));
          if (found && row[found]) return String(row[found]).trim();
        }
        return "";
      };

      let criados = 0;
      let atualizados = 0;
      let erros = 0;
      const detalhes: string[] = [];

      for (const row of rows) {
        const cnpjRaw = getCol(row, "cnpj", "CNPJ");
        const razaoSocial = getCol(row, "razaosocial", "razao social", "empresa", "nome", "razão social");
        if (!cnpjRaw || !razaoSocial) {
          erros++;
          detalhes.push(`Linha ignorada: CNPJ ou Razão Social ausente`);
          continue;
        }

        const cnpj = formatCnpj(cnpjRaw);
        const municipio = getCol(row, "municipio", "município", "cidade", "city") || null;
        const estado =
          (getCol(row, "estado", "uf", "state", "UF") || "").slice(0, 2).toUpperCase() || null;
        const nomeFantasia = getCol(row, "nomefantasia", "nome fantasia", "fantasia") || null;
        const email = getCol(row, "email", "e-mail") || null;
        const telefone = getCol(row, "telefone", "fone", "celular", "tel") || null;
        const nomeContato =
          getCol(row, "nomecontato", "nome contato", "contato", "responsavel", "responsável") || null;
        const inscricaoEstadual = getCol(row, "inscricaoestadual", "ie", "inscrição estadual") || null;
        const inscricaoMunicipal =
          getCol(row, "inscricaomunicipal", "im", "inscrição municipal") || null;

        try {
          const existing = await getClienteByCnpj(cnpj);
          if (existing) {
            await updateCliente(existing.id, {
              razaoSocial,
              municipio,
              estado,
              nomeFantasia,
              email,
              telefone,
              nomeContato,
              inscricaoEstadual,
              inscricaoMunicipal,
            });
            atualizados++;
          } else {
            await createCliente({
              cnpj,
              razaoSocial,
              municipio,
              estado,
              nomeFantasia,
              email,
              telefone,
              nomeContato,
              inscricaoEstadual,
              inscricaoMunicipal,
              ativo: true,
            });
            criados++;
          }
        } catch (err) {
          erros++;
          detalhes.push(`Erro ao processar CNPJ ${cnpj}: ${err instanceof Error ? err.message : "desconhecido"}`);
        }
      }

      return { criados, atualizados, erros, total: rows.length, detalhes };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const cliente = await getClienteById(input.id);
      if (!cliente) throw new TRPCError({ code: "NOT_FOUND" });
      const emails = await getEmailsAlerta(input.id);
      return { ...cliente, emailsAlerta: emails.map((e) => e.email) };
    }),

  getByCnpj: protectedProcedure
    .input(z.object({ cnpj: z.string() }))
    .query(async ({ input }) => {
      return getClienteByCnpj(input.cnpj);
    }),

  create: protectedProcedure.input(clienteSchema).mutation(async ({ input }) => {
    const existing = await getClienteByCnpj(input.cnpj);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "CNPJ já cadastrado." });

    const { emailsAlerta: emails, dataAbertura, ...rest } = input;
    const id = await createCliente({
      ...rest,
      dataAbertura: parseDate(dataAbertura) ?? null,
    });

    if (emails && emails.length > 0) {
      await setEmailsAlerta(id, emails);
    }
    return { id };
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), data: clienteSchema.partial() }))
    .mutation(async ({ input }) => {
      const { emailsAlerta: emails, dataAbertura, semRegistro, ...rest } = input.data;
      await updateCliente(input.id, {
        ...rest,
        dataAbertura: dataAbertura !== undefined ? (parseDate(dataAbertura) ?? undefined) : undefined,
        ...(semRegistro !== undefined ? { semRegistro } : {}),
      });
      if (emails !== undefined) {
        await setEmailsAlerta(input.id, emails);
      }
      return { success: true };
    }),

  delete: gestorProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCliente(input.id);
      return { success: true };
    }),

  // ─── Reenriquecimento individual via BrasilAPI ─────────────────────────────
  reenriquecer: gestorProcedure.use(requirePermissao("clientes", "atualizar_receita"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const cliente = await getClienteById(input.id);
      if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente n\u00e3o encontrado." });

      const cnpjLimpo = cliente.cnpj.replace(/\D/g, "");
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
        headers: { "User-Agent": "GestaoAlvaras/1.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const status = res.status === 404 ? "cnpj_invalido" : "erro";
        await updateCliente(input.id, { dadosReceitaStatus: status });
        throw new TRPCError({ code: "BAD_REQUEST", message: `BrasilAPI retornou ${res.status}.` });
      }

      const dados = await res.json();
      const cnaesSecundarios = (dados.cnaes_secundarios ?? []).map((c: any) => ({ codigo: c.codigo, descricao: c.descricao }));
      const cidade = dados.municipio
        ? dados.municipio.toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
        : undefined;

      await updateCliente(input.id, {
        nomeFantasia: dados.nome_fantasia || cliente.nomeFantasia,
        dataAbertura: dados.data_inicio_atividade ? new Date(dados.data_inicio_atividade) : undefined,
        logradouro: dados.logradouro ?? undefined,
        numero: dados.numero ?? undefined,
        complemento: dados.complemento || undefined,
        bairro: dados.bairro ?? undefined,
        cidade,
        uf: dados.uf ?? undefined,
        cep: dados.cep ?? undefined,
        situacaoCadastral: dados.descricao_situacao_cadastral ?? undefined,
        cnaePrincipal: dados.cnae_fiscal ? String(dados.cnae_fiscal) : undefined,
        cnaePrincipalDescricao: dados.cnae_fiscal_descricao ?? undefined,
        cnaesSecundarios: cnaesSecundarios.length > 0 ? JSON.stringify(cnaesSecundarios) : undefined,
        porte: dados.porte ?? undefined,
        naturezaJuridica: dados.natureza_juridica ? `${dados.codigo_natureza_juridica} - ${dados.natureza_juridica}` : undefined,
        capitalSocial: dados.capital_social ? String(dados.capital_social) : undefined,
        dadosReceitaStatus: "ok",
        dadosReceitaAtualizadoEm: new Date(),
      });

      return { success: true };
    }),

  // ─── Painel Comercial: Sem Registro ──────────────────────────────────────────

  listSemRegistro: gestorProcedure
    .input(z.object({ search: z.string().optional(), estado: z.string().optional(), municipio: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const todos = await listClientesComCobertura(input ?? undefined);
      return todos.filter((c) => c.cobertura === "Sem Registro");
    }),

  exportarSemRegistroXlsx: gestorProcedure
    .input(z.object({ search: z.string().optional(), estado: z.string().optional(), municipio: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const todos = await listClientesComCobertura(input ?? undefined);
      const semRegistro = todos.filter((c) => c.cobertura === "Sem Registro");
      const rows = semRegistro.map((c, i) => ({
        "#": i + 1,
        "Razão Social": c.razaoSocial,
        "CNPJ": formatCnpj(c.cnpj),
        "Nome Fantasia": c.nomeFantasia ?? "",
        "Município": c.municipio ?? c.cidade ?? "",
        "Estado": c.estado ?? c.uf ?? "",
        "Contato": c.nomeContato ?? "",
        "Telefone": c.telefone ?? "",
        "E-mail": c.email ?? "",
        "Status Cobertura": "Sem Registro",
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 5 }, { wch: 45 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 8 }, { wch: 25 }, { wch: 18 }, { wch: 35 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "Sem Registro");
      const buf = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      return { base64: buf as string, filename: `clientes_sem_registro_${new Date().toISOString().slice(0, 10)}.xlsx`, total: semRegistro.length };
    }),

  enviarEmailComercialSemRegistro: gestorProcedure
    .input(z.object({
      destinatarios: z.array(z.string().email()).min(1, "Informe ao menos um e-mail destinatário"),
      search: z.string().optional(),
      estado: z.string().optional(),
      municipio: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { enviarEmailComercialSemRegistro: enviarEmail } = await import("../services/emailComercial");
      const todos = await listClientesComCobertura({ search: input.search, estado: input.estado, municipio: input.municipio });
      const semRegistro = todos.filter((c) => c.cobertura === "Sem Registro");
      if (semRegistro.length === 0) return { success: false, message: "Nenhum cliente sem registro encontrado." };
      await enviarEmail(input.destinatarios, semRegistro);
      return { success: true, total: semRegistro.length };
    }),

  // Toggle rápido de "Sem Registro" diretamente na listagem (GESTOR/MASTER)
  toggleSemRegistro: gestorProcedure.use(requirePermissao("clientes", "marcar_sem_registro"))
    .input(z.object({
      id: z.number(),
      semRegistro: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await updateCliente(input.id, { semRegistro: input.semRegistro });
      return { success: true };
    }),
});
