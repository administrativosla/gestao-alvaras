import { describe, expect, it } from "vitest";
import { lerFiltrosRelatorioDec, linkRelatorioDec } from "../client/src/lib/decRelatorio";
import { paginarSecaoPdf } from "../client/src/lib/exportarPdfDec";

describe("exportação do painel DEC", () => {
  it("preserva os quatro filtros usados na dashboard e solicita o download", () => {
    const link = linkRelatorioDec({ inicio: "2026-10-01", fim: "2026-10-06", categoriaId: 9, operadorId: 5, clienteId: 34 });
    expect(link).toBe("/dec/relatorio?inicio=2026-10-01&fim=2026-10-06&categoriaId=9&operadorId=5&clienteId=34&baixar=1");
    expect(lerFiltrosRelatorioDec(link.split("?")[1], new Date(2026, 9, 6))).toEqual({ inicio: "2026-10-01", fim: "2026-10-06", categoriaId: 9, operadorId: 5, clienteId: 34 });
  });
  it("ignora IDs suspeitos e datas inexistentes em links diretos", () => {
    expect(lerFiltrosRelatorioDec("?inicio=2026-02-30&fim=2026-10-06&clienteId=-1&operadorId=9007199254740993123&categoriaId=3", new Date(2026, 9, 6)))
      .toEqual({ inicio: "2026-10-01", fim: "2026-10-06", categoriaId: 3, operadorId: undefined, clienteId: undefined });
  });
  it("mantém cartões inteiros na mesma página quando cabem", () => {
    expect(paginarSecaoPdf(1000, 350, 186, 265, 120)).toEqual([{ inicioPx: 0, alturaPx: 350, novaPagina: false }]);
    expect(paginarSecaoPdf(1000, 350, 186, 265, 20)).toEqual([{ inicioPx: 0, alturaPx: 350, novaPagina: true }]);
  });
  it("cobre todo um gráfico longo em páginas consecutivas sem perder nem repetir pixels", () => {
    const fatias = paginarSecaoPdf(1000, 3200, 186, 265, 80);
    expect(fatias.length).toBeGreaterThan(1);
    expect(fatias[0].novaPagina).toBe(true);
    expect(fatias.reduce((soma, f) => soma + f.alturaPx, 0)).toBe(3200);
    fatias.forEach((f, i) => {
      expect(f.inicioPx).toBe(i ? fatias[i - 1].inicioPx + fatias[i - 1].alturaPx : 0);
      expect(f.alturaPx * 186 / 1000).toBeLessThanOrEqual(265);
    });
  });
});
