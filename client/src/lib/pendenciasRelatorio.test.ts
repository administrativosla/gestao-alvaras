import { describe, expect, it } from "vitest";
import { lerFiltrosRelatorioPendencias, linkRelatorioPendencias } from "./pendenciasRelatorio";

describe("relatório periódico de pendências", () => {
  it("monta a rota de relatório com filtros e pedido de download", () => {
    expect(linkRelatorioPendencias({
      inicio: "2026-10-01",
      fim: "2026-10-20",
      status: "links_enviados",
      tipo: "coworking",
    })).toBe("/pendencias-contrato/relatorio?inicio=2026-10-01&fim=2026-10-20&status=links_enviados&tipo=coworking&baixar=1");
  });

  it("usa mês corrente e descarta filtros inválidos", () => {
    expect(lerFiltrosRelatorioPendencias("?inicio=invalido&fim=2026-18-40&status=desconhecido&tipo=outro", new Date(2026, 9, 20))).toEqual({
      inicio: "2026-10-01",
      fim: "2026-10-20",
      status: undefined,
      tipo: undefined,
    });
  });

  it("preserva filtros válidos da URL", () => {
    expect(lerFiltrosRelatorioPendencias("?inicio=2026-09-01&fim=2026-09-30&status=assinado_parcial&tipo=prestacao_servico")).toEqual({
      inicio: "2026-09-01",
      fim: "2026-09-30",
      status: "assinado_parcial",
      tipo: "prestacao_servico",
    });
  });
});
