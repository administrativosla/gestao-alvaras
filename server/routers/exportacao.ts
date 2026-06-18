import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getHistoricoByAlvara, listAlvaras } from "../db";
import * as XLSX from "xlsx";

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

export const exportacaoRouter = router({
  alvaras: publicProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          tipo: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      const rows = await listAlvaras(input);

      const data = rows.map((r) => ({
        "CNPJ": r.cliente.cnpj,
        "Razão Social": r.cliente.razaoSocial,
        "Nome Fantasia": r.cliente.nomeFantasia ?? "",
        "Número do Alvará": r.alvara.numeroAlvara ?? "",
        "Tipo": r.alvara.tipo,
        "Órgão Emissor": r.alvara.orgaoEmissor ?? "",
        "Data de Emissão": formatDate(r.alvara.dataEmissao),
        "Data de Vencimento": formatDate(r.alvara.dataVencimento),
        "Status": r.alvara.status,
        "Dias para Vencimento": (() => {
          if (!r.alvara.dataVencimento) return "";
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const venc = new Date(r.alvara.dataVencimento);
          venc.setHours(0, 0, 0, 0);
          return Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        })(),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Alvarás");

      // Ajusta largura das colunas
      ws["!cols"] = [
        { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 20 },
        { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 18 },
        { wch: 22 }, { wch: 20 },
      ];

      const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      return { base64: buffer, fileName: `alvaras_${new Date().toISOString().split("T")[0]}.xlsx` };
    }),

  historico: publicProcedure
    .input(z.object({ alvaraId: z.number() }))
    .mutation(async ({ input }) => {
      const historico = await getHistoricoByAlvara(input.alvaraId);

      const data = historico.map((h) => ({
        "Data/Hora": new Date(h.createdAt).toLocaleString("pt-BR"),
        "Status Anterior": h.statusAnterior ?? "—",
        "Novo Status": h.statusNovo,
        "Observação": h.observacao ?? "",
        "Colaborador": h.colaborador ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico");

      ws["!cols"] = [
        { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 50 }, { wch: 25 },
      ];

      const buffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      return { base64: buffer, fileName: `historico_alvara_${input.alvaraId}_${new Date().toISOString().split("T")[0]}.xlsx` };
    }),
});
